import type {DB} from './db.js';
import type {Server} from 'socket.io';
import {randomUUID} from 'node:crypto';
type Ring={id:string;room:any;caller:any;recipient:string;source:string;expires_at:number};
function fail(status:number,message:string):never{throw Object.assign(new Error(message),{status});}
export function ringingService(db:DB,io:Server,access:(user:string,room:string)=>Promise<any>,members:(room:any)=>Promise<any[]>,blocked:(a:string,b:string)=>Promise<boolean>){
 const pending=new Map<string,Ring>();let queue:Promise<any>=Promise.resolve();
 function serial<T>(fn:()=>Promise<T>):Promise<T>{const result=queue.then(fn);queue=result.catch(()=>{});return result;}
 const packet=(r:Ring)=>({id:r.id,room:r.room,caller:r.caller,expires_at:new Date(r.expires_at).toISOString()});
 async function finish(r:Ring,status:string){if(!pending.delete(r.id))return;await db.query('UPDATE call_history SET status=$2,answered_at=now() WHERE id=$1 AND status=\'ringing\'',[r.id,status]);io.to('user:'+r.recipient).emit('ring-ended',{id:r.id,status});io.to('user:'+r.caller.id).emit('ring-result',{id:r.id,room:r.room.id,status,recipient:r.recipient});if(status==='missed')await db.query('INSERT INTO notifications(id,user_id,actor_id,room_id,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),r.recipient,r.caller.id,r.room.id,'Chamada perdida de '+r.caller.name]);}
 return {
 start:(user:any,roomId:string,source:string)=>serial(async()=>{
  const room=await access(user.id,roomId);if(room.server_id)return {rings:[],message:'Canais de comunidade ficam abertos para entrada; use DM ou grupo para tocar.'};
  const socket=io.sockets.sockets.get(source);if(!socket||socket.data.user.id!==user.id||socket.data.call!==roomId)fail(403,'Entre na chamada antes de ligar.');
  if(pending.size>200)fail(429,'Muitas chamadas pendentes. Tente novamente.');
  const existing=[...pending.values()].filter(r=>r.source===source&&r.room.id===roomId);if(existing.length)return {rings:existing.map(packet)};
  const created=[];for(const member of await members(room)){
   const target=member.user_id;if(target===user.id||await blocked(user.id,target))continue;
   const [profile]=await db.query('SELECT status FROM users WHERE id=$1',[target]);const [preferences]=await db.query('SELECT muted FROM room_members WHERE room_id=$1 AND user_id=$2',[roomId,target]);
   if(preferences?.muted||profile?.status==='busy')continue;
   const sockets=[...io.sockets.sockets.values()].filter(s=>s.data.user.id===target);if(sockets.some(s=>s.data.call===roomId))continue;
   const status=sockets.some(s=>s.data.call)||[...pending.values()].some(r=>r.recipient===target)?'busy':sockets.length?'ringing':'missed';
   const r:Ring={id:randomUUID(),room,caller:{id:user.id,name:user.display_name,avatar_id:user.avatar_id},recipient:target,source,expires_at:Date.now()+45_000};
   await db.query('INSERT INTO call_history(id,room_id,caller_id,recipient_id,status) VALUES($1,$2,$3,$4,$5)',[r.id,roomId,user.id,target,status]);
   if(status==='ringing'){pending.set(r.id,r);io.to('user:'+target).emit('ring-incoming',packet(r));created.push(packet(r));}
   else{io.to('user:'+user.id).emit('ring-result',{id:r.id,room:roomId,status,recipient:target});if(status==='missed')await db.query('INSERT INTO notifications(id,user_id,actor_id,room_id,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),target,user.id,roomId,'Chamada perdida de '+user.display_name]);}
  }
  return {rings:created,message:created.length?'Chamando…':'Ninguém disponível para tocar agora. A sala continua aberta.'};
 }),
 respond:(user:string,ringId:string,action:'accept'|'decline')=>serial(async()=>{const r=pending.get(ringId);if(!r||r.recipient!==user)fail(404,'Chamada não está mais disponível');if(Date.now()>=r.expires_at){await finish(r,'missed');fail(410,'Chamada expirada');}await access(user,r.room.id);if(await blocked(user,r.caller.id))fail(403,'Chamada bloqueada');if(action==='accept'&&!io.sockets.sockets.get(r.source)?.data.call){await finish(r,'cancelled');fail(410,'A pessoa já saiu da chamada');}await finish(r,action==='accept'?'accepted':'declined');return {room:r.room};}),
 cancel:(user:string,ringId:string)=>serial(async()=>{const r=pending.get(ringId);if(r&&r.caller.id!==user)fail(403,'Sem permissão');if(r)await finish(r,'cancelled');return {ok:true};}),
 joined:(user:string,room:string)=>serial(async()=>{for(const r of [...pending.values()])if(r.recipient===user&&r.room.id===room)await finish(r,'accepted');}),
 cancelSocket:(source:string)=>serial(async()=>{for(const r of [...pending.values()])if(r.source===source)await finish(r,'cancelled');}),
 expire:()=>serial(async()=>{for(const r of [...pending.values()])if(r.expires_at<=Date.now())await finish(r,'missed');}),
 sync:(user:string)=>[...pending.values()].filter(r=>r.recipient===user&&r.expires_at>Date.now()).map(packet),
 async history(user:string){return db.query(`SELECT h.*,c.display_name AS caller_name,t.display_name AS recipient_name,r.name AS room_name FROM call_history h JOIN users c ON c.id=h.caller_id JOIN users t ON t.id=h.recipient_id JOIN rooms r ON r.id=h.room_id WHERE h.caller_id=$1 OR h.recipient_id=$1 ORDER BY h.created_at DESC LIMIT 40`,[user]);}
 };
}
