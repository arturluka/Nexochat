import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import type {DB} from './db.js';
const addedTables=['ownership_offers','shop_gifts','call_preferences','forum_topics','event_polls','event_poll_votes','event_reminders'];
const tables=['users','servers','roles','categories','rooms','attachments','server_members','room_members','relations','invites','shop_items','inventory','daily_rewards','wallet_ledger','call_history','user_badges','room_roles','community_assets','messages','threads','reactions','notifications','audit','message_pins','favorites','polls','poll_votes','community_events','event_rsvps','reports','account_security','recovery_codes','scheduled_messages','weekly_claims',...addedTables];
export async function createBackup(db:DB,uploads:string,password:string){
 if(password.length<16)throw new Error('BACKUP_PASSWORD precisa ter pelo menos 16 caracteres.');
 const content:any={format:'nexochat-7',created_at:new Date().toISOString(),tables:{},files:{}};
 await db.transaction(async tx=>{for(const table of tables)content.tables[table]=await tx.query('SELECT * FROM "'+table+'"');});
 for(const a of content.tables.attachments)content.files[a.id]=(await readFile(path.join(uploads,a.id))).toString('base64');
 const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(password,salt,32),cipher=createCipheriv('aes-256-gcm',key,iv);
 const encrypted=Buffer.concat([cipher.update(gzipSync(JSON.stringify(content))),cipher.final()]);return Buffer.concat([Buffer.from('NEXO6'),salt,iv,cipher.getAuthTag(),encrypted]);
}
export async function restoreBackup(db:DB,uploads:string,password:string,input:Buffer){
 if(input.subarray(0,5).toString()!=='NEXO6'||input.length<50)throw new Error('Backup inválido.');
 const decipher=createDecipheriv('aes-256-gcm',scryptSync(password,input.subarray(5,21),32),input.subarray(21,33));decipher.setAuthTag(input.subarray(33,49));
 const data=JSON.parse(gunzipSync(Buffer.concat([decipher.update(input.subarray(49)),decipher.final()]),{maxOutputLength:256*1024*1024}).toString());
 if(!['nexochat-6','nexochat-7'].includes(data.format))throw new Error('Versão incompatível.');
 if((await db.query('SELECT 1 FROM users LIMIT 1')).length)throw new Error('Restauração exige um banco vazio. Use um novo DATA_DIR ou DATABASE_URL.');
 await mkdir(uploads,{recursive:true});if((await readdir(uploads)).length)throw new Error('Restauração exige uma pasta de anexos vazia.');
 for(const a of data.tables.attachments){if(!/^[0-9a-f-]{36}$/i.test(a.id)||typeof data.files[a.id]!=='string'||Buffer.from(data.files[a.id],'base64').length!==a.size)throw new Error('Anexo inválido no backup.');}
 await db.transaction(async tx=>{
  const catalog=await tx.query('SELECT * FROM shop_items');
  await tx.query('DELETE FROM shop_items');
  if(data.format==='nexochat-6')for(const t of addedTables)data.tables[t]=[];
  for(const table of tables){const cols=await tx.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[table]);
   if(!Array.isArray(data.tables[table]))throw new Error('Tabela ausente: '+table);
   for(const original of data.tables[table]){const row={...original};if(table==='messages'){row.reply_id=null;row.thread_id=null;}
    const names=Object.keys(row);if(names.some(n=>!cols.some(c=>c.column_name===n)))throw new Error('Coluna inválida.');
    const values=names.map(n=>cols.find(c=>c.column_name===n).data_type==='jsonb'?JSON.stringify(row[n]):row[n]);
    await tx.query('INSERT INTO "'+table+'" ('+names.map(n=>'"'+n+'"').join(',')+') VALUES('+names.map((_,i)=>'$'+(i+1)).join(',')+')',values);
   }
  }
  for(const item of catalog)await tx.query('INSERT INTO shop_items(id,name,description,price,color,kind) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',[item.id,item.name,item.description,item.price,item.color,item.kind]);
  for(const row of data.tables.messages)if(row.reply_id||row.thread_id)await tx.query('UPDATE messages SET reply_id=$2,thread_id=$3 WHERE id=$1',[row.id,row.reply_id,row.thread_id]);
  for(const a of data.tables.attachments)await writeFile(path.join(uploads,a.id),Buffer.from(data.files[a.id],'base64'),{flag:'wx',mode:0o600});
 });
}
if(process.argv[1]?.endsWith('backup.ts')){
 const {openDb,dataDir}=await import('./db.js');const {migrate}=await import('./migrate.js');const [action,file]=process.argv.slice(2);const password=process.env.BACKUP_PASSWORD||'';
 if(!['create','restore'].includes(action)||!file||password.length<16)throw new Error('Use backup.ts create|restore arquivo.nexobackup com BACKUP_PASSWORD de 16+ caracteres. Pare a aplicação primeiro.');
 const db=await openDb();try{await migrate(db);if(action==='create')await writeFile(path.resolve(file),await createBackup(db,path.join(dataDir,'uploads'),password),{flag:'wx',mode:0o600});else await restoreBackup(db,path.join(dataDir,'uploads'),password,await readFile(path.resolve(file)));console.log(action==='create'?'Backup criptografado criado.':'Backup restaurado. Entre novamente nas contas.');}finally{await db.close();}
}
