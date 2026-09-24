import {BADGES} from '@nexo/shared/badges';
import {randomUUID} from 'node:crypto';
import type {DB,QueryDb} from './db.js';
function fail(status:number,message:string):never{throw Object.assign(new Error(message),{status});}
async function progress(db:QueryDb,user:string){
 const [r]=await db.query(`SELECT
 (SELECT CASE WHEN length(trim(bio))>0 AND length(trim(custom_status))>0 THEN 1 ELSE 0 END FROM users WHERE id=$1) AS identity,
 (SELECT count(*) FROM relations WHERE (sender=$1 OR recipient=$1) AND state='accepted') AS friend,
 (SELECT count(*) FROM servers WHERE owner_id=$1) AS community,
 (SELECT count(*) FROM inventory i JOIN shop_items s ON s.id=i.item_id WHERE i.user_id=$1 AND s.kind='frame') AS style,
 (SELECT count(*) FROM daily_rewards WHERE user_id=$1) AS regular,
 (SELECT count(*) FROM call_history WHERE (caller_id=$1 OR recipient_id=$1) AND status='accepted') AS call`,[user]);
 return {...r,arrival:1,collector:r.style};
}
export function badgeService(db:DB){return {
 async view(user:string){const p=await progress(db,user);const owned=await db.query('SELECT badge_id,earned_at FROM user_badges WHERE user_id=$1',[user]);const [u]=await db.query('SELECT displayed_badges FROM users WHERE id=$1',[user]);return {displayed:u.displayed_badges,items:BADGES.map(b=>({...b,progress:Math.min(b.target,Number(p[b.id])||0),earned_at:owned.find((o:any)=>o.badge_id===b.id)?.earned_at||null}))};},
 async claim(user:string,id:string){return db.transaction(async tx=>{
  await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);const b=BADGES.find(b=>b.id===id);if(!b)fail(404,'Insígnia não encontrada');
  const p=await progress(tx,user);if(Number(p[id])<b.target)fail(403,'Conclua a conquista antes de resgatar.');
  const rows=await tx.query('INSERT INTO user_badges(user_id,badge_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING badge_id',[user,id]);if(!rows.length)fail(409,'Você já resgatou essa conquista.');
  await tx.query('UPDATE users SET sparks=sparks+$2 WHERE id=$1',[user,b.reward]);await tx.query('INSERT INTO wallet_ledger(id,user_id,amount,reason) VALUES($1,$2,$3,$4)',[randomUUID(),user,b.reward,'Conquista: '+b.name]);return {ok:true,reward:b.reward};
 });},
 async display(user:string,ids:string[]){const owned=await db.query('SELECT badge_id FROM user_badges WHERE user_id=$1',[user]);if(ids.some(id=>!owned.some((o:any)=>o.badge_id===id)))fail(403,'Você só pode exibir insígnias conquistadas.');await db.query('UPDATE users SET displayed_badges=$2::jsonb WHERE id=$1',[user,JSON.stringify(ids)]);return {ok:true};}
};}
