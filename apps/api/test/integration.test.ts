import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {io as connect,type Socket} from 'socket.io-client';

test('contas, sessões, amizades, mensagens, uploads, permissões e sinalização',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'nexo-test-'));process.env.DATA_DIR=dir;process.env.DATABASE_URL='';process.env.APP_ORIGIN='http://localhost:5173';
 const {openDb}=await import('../src/db.js');const {migrate}=await import('../src/migrate.js');const {createApp}=await import('../src/app.js');
 const db=await openDb();await migrate(db);const svc=createApp(db);await new Promise<void>(resolve=>svc.http.listen(0,'127.0.0.1',resolve));const port=(svc.http.address() as any).port;const base=`http://127.0.0.1:${port}`;const sockets:Socket[]=[];
 const cookies:Record<string,string>={};
 async function req(who:string,url:string,method='GET',body?:any,expected=200){const r=await fetch(base+'/api'+url,{method,headers:{Origin:'http://localhost:5173',...(cookies[who]?{Cookie:cookies[who]}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});const cookie=r.headers.get('set-cookie');if(cookie)cookies[who]=cookie.split(';')[0];const d=await r.json();assert.equal(r.status,expected,`${method} ${url}: ${JSON.stringify(d)}`);return d;}
 async function socket(who:string){const s=connect(base,{transports:['websocket'],extraHeaders:{Cookie:cookies[who],Origin:'http://localhost:5173'},reconnection:false});sockets.push(s);await new Promise<void>((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
 async function event(s:Socket,name:string,data:any){return new Promise<any>((resolve,reject)=>{s.timeout(3000).emit(name,data,(e:any,r:any)=>e?reject(e):resolve(r));});}
 try{
  for(const name of ['alice','bobby','carol'])await req(name,'/auth/register','POST',{username:name,password:'A-strong-password-123'});
  await req('duplicate','/auth/register','POST',{username:'alice',password:'A-strong-password-123'},409);
  await req('bad','/auth/login','POST',{username:'alice',password:'incorrect-password'},401);
  const alice=(await req('alice','/state')).me,bob=(await req('bobby','/state')).me,carol=(await req('carol','/state')).me;
  const csrf=await fetch(base+'/api/profile',{method:'PATCH',headers:{Cookie:cookies.alice,'Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
  await req('alice','/rooms','POST',{kind:'dm',name:'Bob',users:['bobby']},403);
  await req('alice','/friends','POST',{username:'bobby'});await req('bobby','/friends/'+alice.id+'/accept','POST');
  const dm=await req('alice','/rooms','POST',{kind:'dm',name:'Bob',users:['bobby']});assert.equal((await req('bobby','/rooms','POST',{kind:'dm',name:'Alice',users:['alice']})).id,dm.id);
  await req('carol','/rooms/'+dm.id+'/messages','GET',undefined,403);
  const sa=await socket('alice'),sb=await socket('bobby');assert.equal((await event(sb,'watch',{room:dm.id})).ok,true);
  const typed=new Promise<any>(resolve=>sb.once('typing',resolve));await event(sa,'typing',{room:dm.id});assert.equal((await typed).user_id,alice.id);
  const m=await req('alice','/rooms/'+dm.id+'/messages','POST',{body:'Olá @bobby!'});const response=await req('bobby','/rooms/'+dm.id+'/messages','POST',{body:'Oi Alice',reply_id:m.id});
  await req('alice','/messages/'+m.id,'PATCH',{body:'Mensagem editada'});await req('bobby','/messages/'+m.id,'PATCH',{body:'roubada'},403);
  await req('bobby','/messages/'+m.id+'/reactions','POST',{emoji:'💜'});let history=await req('bobby','/rooms/'+dm.id+'/messages');assert.equal(history.messages[0].body,'Mensagem editada');assert.equal(history.messages[0].reactions[0].emoji,'💜');assert.equal(history.messages[1].reply_id,m.id);
  await req('bobby','/rooms/'+dm.id+'/read','POST');history=await req('alice','/rooms/'+dm.id+'/messages');assert.ok(history.readers.some((r:any)=>r.user_id===bob.id&&r.last_read_at));
  const badFile=new FormData();badFile.append('file',new Blob(['<script>alert(1)</script>'],{type:'image/png'}),'fake.png');await req('alice','/upload?room='+dm.id,'POST',badFile,400);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4Z8AAAAASUVORK5CYII=','base64');const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'pixel.png');const attachment=await req('alice','/upload?room='+dm.id,'POST',form);await req('alice','/rooms/'+dm.id+'/messages','POST',{body:'imagem',attachment_id:attachment.id});const forbidden=await fetch(base+'/api/files/'+attachment.id,{headers:{Cookie:cookies.carol}});assert.equal(forbidden.status,403);
  const served=await fetch(base+'/api/files/'+attachment.id,{headers:{Cookie:cookies.bobby}});assert.equal(served.status,200);assert.equal(served.headers.get('content-type'),'image/png');
  const group=await req('alice','/rooms','POST',{kind:'group',name:'Turma',users:['bobby']});await req('alice','/rooms/'+group.id,'PATCH',{name:'Turma nova'});await req('bobby','/rooms/'+group.id,'PATCH',{name:'invadida'},403);
  const temporary=await req('alice','/rooms','POST',{kind:'temporary',name:'Hoje',users:['bobby']});assert.ok((await req('alice','/state')).rooms.find((r:any)=>r.id===temporary.id).expires_at);
  const community=await req('alice','/servers','POST',{name:'Nexo Clube'});const invite=await req('alice','/servers/'+community.id+'/invites','POST');await req('bobby','/invites/'+invite.code+'/join','POST');
  let state=await req('bobby','/state');const channel=state.rooms.find((r:any)=>r.server_id===community.id&&r.kind==='text');await req('bobby','/rooms','POST',{kind:'text',name:'sem permissão',server_id:community.id},403);
  await req('alice','/servers/'+community.id+'/categories','POST',{name:'Jogos'});
  await req('alice','/servers/'+community.id+'/roles','POST',{name:'Leitor',permissions:[]});const manage=await req('alice','/servers/'+community.id+'/manage');await req('alice','/servers/'+community.id+'/members/'+bob.id,'PATCH',{action:'role',role_id:manage.roles[0].id});await req('bobby','/rooms/'+channel.id+'/messages','POST',{body:'não permitido'},403);
  await req('alice','/servers/'+community.id+'/members/'+bob.id,'PATCH',{action:'role',role_id:null});await req('bobby','/rooms/'+channel.id+'/messages','POST',{body:'permitido'});
  const joinA=await event(sa,'call-join',{room:dm.id}),joinB=await event(sb,'call-join',{room:dm.id});assert.equal(joinA.ok,true);assert.equal(joinB.peers[0].id,sa.id);
  const signal=new Promise<any>(resolve=>sa.once('signal',resolve));assert.equal((await event(sb,'signal',{to:sa.id,description:{type:'offer',sdp:'test-sdp'}})).ok,true);assert.equal((await signal).description.sdp,'test-sdp');await event(sb,'call-leave',{});assert.equal((await event(sb,'signal',{to:sa.id,description:{type:'offer',sdp:'test'}})).ok,false);
  await req('alice','/servers/'+community.id+'/members/'+bob.id,'PATCH',{action:'ban'});await req('bobby','/rooms/'+channel.id+'/messages','GET',undefined,403);await req('bobby','/invites/'+invite.code+'/join','POST',undefined,403);
  await req('alice','/messages/'+m.id,'DELETE');assert.equal((await req('alice','/rooms/'+dm.id+'/messages')).messages.find((x:any)=>x.id===m.id).deleted,true);
  await req('alice','/blocks/'+bob.id,'POST');await req('bobby','/rooms/'+dm.id+'/messages','POST',{body:'bloqueado'},403);await req('alice','/blocks/'+bob.id,'DELETE');
  await req('alice','/auth/logout','POST');await req('alice','/state','GET',undefined,401);await req('alice','/auth/login','POST',{username:'alice',password:'A-strong-password-123'});const sessions=await req('alice','/sessions');await req('alice','/sessions/'+sessions[0].id,'DELETE');await req('alice','/state','GET',undefined,401);
  console.log('Fluxos principais e controles de acesso validados.');
 }finally{for(const s of sockets)s.disconnect();await svc.close();await rm(dir,{recursive:true,force:true});}
});
