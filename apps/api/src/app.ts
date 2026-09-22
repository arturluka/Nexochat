import express, { type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import argon2 from 'argon2';
import { parse as parseCookie } from 'cookie';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { Server } from 'socket.io';
import { z } from 'zod';
import { credentials, profile, messageInput, roomInput, permissions, username } from '@nexo/shared';
import {badgeService} from './badges.js';
import {shopService} from './shop.js';
import {ringingService} from './ringing.js';
import { type DB, dataDir, root } from './db.js';

const uid = () => randomUUID();
const hash = (s:string) => createHash('sha256').update(s).digest('hex');
const id = z.string().uuid();
const label = z.string().trim().min(1).max(60);
const publicColumns = 'id,username,display_name,bio,avatar_id,status,banner_id,accent_color,pronouns,custom_status,equipped_frame,displayed_badges';
function fail(status:number, message:string):never { throw Object.assign(new Error(message),{status}); }
type AuthRequest = Request & { user:any, session:any };
export function createApp(db:DB) {
 const app = express(); const http = createServer(app);
 const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
 const secure = process.env.COOKIE_SECURE === 'true';
 if (process.env.NODE_ENV === 'production' && (!secure || !origin.startsWith('https://'))) throw new Error('Produção exige HTTPS e COOKIE_SECURE=true');
 app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
 app.use(helmet({contentSecurityPolicy:{directives:{'img-src':["'self'",'blob:','data:'],'media-src':["'self'",'blob:'],'connect-src':["'self'",'ws:','wss:']}}}));
 app.use(express.json({limit:'32kb'}));
 app.use('/api',rateLimit({windowMs:60_000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Muitas requisições. Aguarde um minuto.'}}));
 app.use('/api',(req,res,next) => { if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') !== origin) return res.status(403).json({error:'Origem não permitida'}); next(); });
 const io = new Server(http,{maxHttpBufferSize:64*1024,cors:{origin,credentials:true},allowRequest:(req,done)=>done(null,req.headers.origin===origin)});
 let callQueue:Promise<any>=Promise.resolve();
 const serializeCall=<T,>(fn:()=>Promise<T>):Promise<T>=>{const result=callQueue.then(fn);callQueue=result.catch(()=>{});return result;};
 const first = async (sql:string,args:any[] = []) => (await db.query(sql,args))[0];
 const refresh = () => io.emit('refresh');
 const online = (user:string) => [...io.sockets.sockets.values()].some(s=>s.data.user.id===user);
 async function authenticate(cookie:string | undefined) {
   const token = parseCookie(cookie || '').nexo_session;
   if(!token) return null;
   return first('SELECT s.id AS session_id,s.agent,s.created_at AS session_created,s.expires_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',[hash(token)]);
 }
 const auth = async(req:Request,_res:Response,next:NextFunction)=>{ try { const u=await authenticate(req.headers.cookie); if(!u) fail(401,'Entre na sua conta'); Object.assign(req,{user:u,session:{id:u.session_id}}); next(); } catch(e){next(e);} };
 const route = (fn:(req:AuthRequest,res:Response)=>any) => async(req:Request,res:Response,next:NextFunction)=>{try{await fn(req as AuthRequest,res);}catch(e){next(e);}};
 const blocked = async(a:string,b:string) => !!await first("SELECT 1 FROM relations WHERE state='blocked' AND ((sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1))",[a,b]);
 const friends = async(a:string,b:string) => !!await first("SELECT 1 FROM relations WHERE state='accepted' AND ((sender=$1 AND recipient=$2) OR (sender=$2 AND recipient=$1))",[a,b]);
 async function serverAccess(user:string,server:string,permission?:string) {
   const row=await first('SELECT s.*,m.role_id,r.permissions FROM servers s JOIN server_members m ON m.server_id=s.id LEFT JOIN roles r ON r.id=m.role_id WHERE s.id=$1 AND m.user_id=$2 AND NOT m.banned',[id.parse(server),user]);
   if(!row) fail(403,'Sem acesso à comunidade');
   if(permission && row.owner_id!==user && !(row.permissions||['send','invite']).includes(permission)) fail(403,'Seu cargo não permite esta ação');
   return row;
 }
 async function access(user:string,roomId:string,permission?:string) {
   const room=await first('SELECT * FROM rooms WHERE id=$1 AND (expires_at IS NULL OR expires_at>now())',[id.parse(roomId)]);
   if(!room) fail(404,'Conversa não encontrada');
   if(room.server_id) await serverAccess(user,room.server_id,permission);
   else {
     if(!await first('SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',[roomId,user])) fail(403,'Sem acesso à conversa');
     if(room.kind==='dm') { const other=await first('SELECT user_id FROM room_members WHERE room_id=$1 AND user_id<>$2',[roomId,user]); if(other && await blocked(user,other.user_id)) fail(403,'Conversa bloqueada'); }
     if(permission?.startsWith('manage') && room.owner_id!==user) fail(403,'Apenas o criador pode gerenciar o grupo');
   }
   return room;
 }
 async function members(room:any) { return db.query(room.server_id?'SELECT user_id FROM server_members WHERE server_id=$1 AND NOT banned':'SELECT user_id FROM room_members WHERE room_id=$1',[room.server_id||room.id]); }
 async function notify(user:string,actor:string,body:string,room:string|null=null) { if(user===actor || await blocked(user,actor)) return; await db.query('INSERT INTO notifications(id,user_id,actor_id,body,room_id) VALUES($1,$2,$3,$4,$5)',[uid(),user,actor,body,room]); }
 async function issueSession(req:Request,res:Response,user:any) {
   const token=randomBytes(32).toString('base64url');
   await db.query("INSERT INTO sessions(id,user_id,token_hash,agent,expires_at) VALUES($1,$2,$3,$4,now()+interval '30 days')",[uid(),user.id,hash(token),(req.get('user-agent')||'Desconhecido').slice(0,200)]);
   res.cookie('nexo_session',token,{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:30*86400_000});
   res.json({ok:true});
 }
 const loginLimit=rateLimit({windowMs:15*60_000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Muitas tentativas. Aguarde 15 minutos.'}});
 app.post('/api/auth/register',loginLimit,route(async(req,res)=>{
   const x=credentials.parse(req.body); const user={id:uid()};
   const passwordHash=await argon2.hash(x.password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
   await db.query('INSERT INTO users(id,username,password_hash,display_name) VALUES($1,$2,$3,$2)',[user.id,x.username,passwordHash]);
   await issueSession(req,res,user);
 }));
 app.post('/api/auth/login',loginLimit,route(async(req,res)=>{
   const x=credentials.parse(req.body); const u=await first('SELECT * FROM users WHERE username=$1',[x.username]);
   if(!u) { await argon2.hash(x.password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1}); fail(401,'Usuário ou senha incorretos'); }
   if(!await argon2.verify(u.password_hash,x.password)) fail(401,'Usuário ou senha incorretos');
   await issueSession(req,res,u);
 }));
 app.get('/api/health',(_req,res)=>res.json({ok:true,version:'0.4.0',database:process.env.DATABASE_URL?'postgresql':'pglite'}));
 app.use('/api',auth);
 app.post('/api/auth/logout',route(async(req,res)=>{await db.query('DELETE FROM sessions WHERE id=$1',[req.session.id]); disconnectSession(req.session.id); res.clearCookie('nexo_session',{path:'/',httpOnly:true,sameSite:'lax',secure});res.json({ok:true});}));
 const badges=badgeService(db);
 const shop=shopService(db);const rings=ringingService(db,io,access,members,blocked);
 const commerceLimit=rateLimit({windowMs:60_000,limit:20,keyGenerator:req=>(req as AuthRequest).user.id});
 app.get('/api/badges',route(async(req,res)=>res.json(await badges.view(req.user.id))));
 app.post('/api/badges/claim',commerceLimit,route(async(req,res)=>{const x=z.object({badge_id:z.string().max(30)}).strict().parse(req.body);res.json(await badges.claim(req.user.id,x.badge_id));refresh();}));
 app.post('/api/badges/display',commerceLimit,route(async(req,res)=>{const x=z.object({ids:z.array(z.string().max(30)).max(3).refine(a=>new Set(a).size===a.length)}).strict().parse(req.body);res.json(await badges.display(req.user.id,x.ids));refresh();}));
 app.get('/api/shop',route(async(req,res)=>res.json(await shop.view(req.user.id))));
 app.post('/api/shop/daily',commerceLimit,route(async(req,res)=>{res.json(await shop.daily(req.user.id));refresh();}));
 app.post('/api/shop/buy',commerceLimit,route(async(req,res)=>{const x=z.object({item_id:z.string().min(1).max(30)}).strict().parse(req.body);res.json(await shop.buy(req.user.id,x.item_id));refresh();}));
 app.post('/api/shop/equip',commerceLimit,route(async(req,res)=>{const x=z.object({item_id:z.string().max(30).nullable()}).strict().parse(req.body);res.json(await shop.equip(req.user.id,x.item_id));refresh();}));
 const ringLimit=rateLimit({windowMs:60_000,limit:5,keyGenerator:req=>(req as AuthRequest).user.id});
 app.post('/api/rooms/:id/ring',ringLimit,route(async(req,res)=>{res.json(await rings.start(req.user,id.parse(req.params.id),z.string().max(64).parse(req.body.socket_id)));refresh();}));
 app.post('/api/rings/:id/respond',route(async(req,res)=>{res.json(await rings.respond(req.user.id,id.parse(req.params.id),z.enum(['accept','decline']).parse(req.body.action)));refresh();}));
 app.delete('/api/rings/:id',route(async(req,res)=>res.json(await rings.cancel(req.user.id,id.parse(req.params.id)))));
 app.get('/api/calls/history',route(async(req,res)=>res.json(await rings.history(req.user.id))));
 app.get('/api/state',route(async(req,res)=>{
   const me=req.user;
   const rooms=await db.query(`SELECT DISTINCT r.*,rm.muted,rm.last_read_at,
     (SELECT count(*)::int FROM messages msg WHERE msg.room_id=r.id AND NOT msg.deleted AND msg.user_id<>$1 AND msg.created_at>COALESCE(rm.last_read_at,'1970-01-01'::timestamptz)) AS unread
     FROM rooms r LEFT JOIN room_members rm ON rm.room_id=r.id AND rm.user_id=$1
     LEFT JOIN server_members sm ON sm.server_id=r.server_id AND sm.user_id=$1
     WHERE (rm.user_id IS NOT NULL AND r.server_id IS NULL OR sm.user_id IS NOT NULL AND NOT sm.banned) AND (r.expires_at IS NULL OR r.expires_at>now()) ORDER BY r.created_at`,[me.id]);
   const servers=await db.query('SELECT s.*,m.role_id,COALESCE(r.permissions,\'["send","invite"]\'::jsonb) AS permissions FROM servers s JOIN server_members m ON m.server_id=s.id LEFT JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 AND NOT m.banned ORDER BY s.created_at',[me.id]);
   const relations=await db.query(`SELECT rel.*,u.username,u.display_name,u.avatar_id,u.status,u.id AS user_id FROM relations rel JOIN users u ON u.id=CASE WHEN rel.sender=$1 THEN rel.recipient ELSE rel.sender END WHERE (rel.sender=$1 OR rel.recipient=$1) AND (rel.state<>'blocked' OR rel.sender=$1)`,[me.id]);
   const users=await db.query(`SELECT DISTINCT u.id,u.username,u.display_name,u.bio,u.avatar_id,u.status,u.banner_id,u.accent_color,u.pronouns,u.custom_status,u.equipped_frame,u.displayed_badges FROM users u WHERE u.id=$1 OR EXISTS(SELECT 1 FROM relations r WHERE (r.sender=$1 AND r.recipient=u.id OR r.recipient=$1 AND r.sender=u.id) AND r.state<>'blocked') OR EXISTS(SELECT 1 FROM room_members a JOIN room_members b ON a.room_id=b.room_id WHERE a.user_id=$1 AND b.user_id=u.id) OR EXISTS(SELECT 1 FROM server_members a JOIN server_members b ON a.server_id=b.server_id WHERE a.user_id=$1 AND b.user_id=u.id AND NOT a.banned AND NOT b.banned)`,[me.id]);
   for(const u of users) if(u.status==='invisible'||!online(u.id)||await blocked(me.id,u.id)) u.status='offline';
   const categories=await db.query('SELECT c.* FROM categories c JOIN server_members m ON m.server_id=c.server_id WHERE m.user_id=$1 AND NOT m.banned',[me.id]);
   const notifications=await db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 80',[me.id]);
   res.json({me:{id:me.id,username:me.username,display_name:me.display_name,bio:me.bio,avatar_id:me.avatar_id,status:me.status,dm_policy:me.dm_policy,read_receipts:me.read_receipts,banner_id:me.banner_id,accent_color:me.accent_color,pronouns:me.pronouns,custom_status:me.custom_status,equipped_frame:me.equipped_frame,sparks:me.sparks,displayed_badges:me.displayed_badges},rooms,servers,relations,users,categories,notifications});
 }));
 app.patch('/api/profile',route(async(req,res)=>{
   const x=profile.parse(req.body);
   for(const aid of [x.avatar_id,x.banner_id])if(aid&&!await first("SELECT 1 FROM attachments WHERE id=$1 AND owner_id=$2 AND room_id IS NULL AND mime LIKE 'image/%'",[aid,req.user.id]))fail(400,'Imagem de perfil inválida');
   await db.query('UPDATE users SET display_name=$2,bio=$3,status=$4,dm_policy=$5,read_receipts=$6,avatar_id=$7,banner_id=$8,accent_color=$9,pronouns=$10,custom_status=$11 WHERE id=$1',[req.user.id,x.display_name,x.bio,x.status,x.dm_policy,x.read_receipts,x.avatar_id===undefined?req.user.avatar_id:x.avatar_id,x.banner_id===undefined?req.user.banner_id:x.banner_id,x.accent_color??req.user.accent_color,x.pronouns??req.user.pronouns,x.custom_status??req.user.custom_status]);
   refresh();res.json({ok:true});
 }));
 app.get('/api/users',route(async(req,res)=>{const q=z.string().min(2).max(24).parse(req.query.q);res.json(await db.query(`SELECT ${publicColumns} FROM users WHERE username LIKE $1 AND id<>$2 AND NOT EXISTS(SELECT 1 FROM relations WHERE state='blocked' AND (sender=$2 AND recipient=users.id OR recipient=$2 AND sender=users.id)) LIMIT 15`,[q.toLowerCase().replace(/[%_]/g,'')+'%',req.user.id]));}));
 app.get('/api/sessions',route(async(req,res)=>res.json((await db.query('SELECT id,agent,created_at,expires_at FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC',[req.user.id])).map(s=>({...s,current:s.id===req.session.id})))));
 function disconnectSession(session:string) { for(const s of io.sockets.sockets.values()) if(s.data.session===session) s.disconnect(true); }
 app.delete('/api/sessions/:id',route(async(req,res)=>{await db.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2',[id.parse(req.params.id),req.user.id]);disconnectSession(String(req.params.id));res.json({ok:true});}));
 app.post('/api/friends',route(async(req,res)=>{const x=z.object({username}).parse(req.body);const u=await first('SELECT * FROM users WHERE username=$1',[x.username]);if(!u||u.id===req.user.id) fail(400,'Usuário inválido');if(await blocked(u.id,req.user.id)) fail(403,'Solicitação indisponível');if(await friends(u.id,req.user.id)) fail(409,'Vocês já são amigos');await db.query("INSERT INTO relations(sender,recipient,state) VALUES($1,$2,'pending') ON CONFLICT DO NOTHING",[req.user.id,u.id]);await notify(u.id,req.user.id,`${req.user.display_name} enviou uma solicitação de amizade`);refresh();res.json({ok:true});}));
 app.post('/api/friends/:id/accept',route(async(req,res)=>{const other=id.parse(req.params.id);if(await blocked(req.user.id,other))fail(403,'Usuário bloqueado');const rows=await db.query("UPDATE relations SET state='accepted' WHERE sender=$1 AND recipient=$2 AND state='pending' RETURNING sender",[other,req.user.id]);if(!rows.length) fail(404,'Solicitação não encontrada');await db.query("DELETE FROM relations WHERE sender=$1 AND recipient=$2 AND state='pending'",[req.user.id,other]);refresh();res.json({ok:true});}));
 app.delete('/api/friends/:id',route(async(req,res)=>{await db.query("DELETE FROM relations WHERE state<>'blocked' AND (sender=$1 AND recipient=$2 OR sender=$2 AND recipient=$1)",[req.user.id,id.parse(req.params.id)]);refresh();res.json({ok:true});}));
 app.post('/api/blocks/:id',route(async(req,res)=>{const other=id.parse(req.params.id);if(other===req.user.id)fail(400,'Usuário inválido');await db.query("DELETE FROM relations WHERE state<>'blocked' AND (sender=$1 AND recipient=$2 OR sender=$2 AND recipient=$1)",[req.user.id,other]);await db.query("INSERT INTO relations(sender,recipient,state) VALUES($1,$2,'blocked') ON CONFLICT(sender,recipient) DO UPDATE SET state='blocked'",[req.user.id,other]);for(const s of io.sockets.sockets.values())if([req.user.id,other].includes(s.data.user.id))s.disconnect(true);refresh();res.json({ok:true});}));
 app.delete('/api/blocks/:id',route(async(req,res)=>{await db.query("DELETE FROM relations WHERE sender=$1 AND recipient=$2 AND state='blocked'",[req.user.id,id.parse(req.params.id)]);refresh();res.json({ok:true});}));
 app.post('/api/rooms',route(async(req,res)=>{
   const x=roomInput.parse(req.body);const roomId=uid();let selected:any[]=[];
   if(x.server_id){ if(!['text','voice','temporary'].includes(x.kind))fail(400,'Tipo de canal inválido');await serverAccess(req.user.id,x.server_id,'manage_channels');if(x.category_id&&!await first('SELECT 1 FROM categories WHERE id=$1 AND server_id=$2',[x.category_id,x.server_id]))fail(400,'Categoria inválida'); }
   else {if(!['dm','group','temporary'].includes(x.kind))fail(400,'Tipo de conversa inválido');for(const name of [...new Set(x.users)]){const u=await first('SELECT * FROM users WHERE username=$1',[name]);if(!u||u.id===req.user.id)fail(400,'Participante inválido');if(await blocked(req.user.id,u.id)||u.dm_policy==='nobody'||u.dm_policy==='friends'&&!await friends(req.user.id,u.id))fail(403,`Privacidade de @${name} impede a conversa`);selected.push(u);}if(x.kind==='dm'&&selected.length!==1)fail(400,'DM exige um destinatário');}
   const dmKey=x.kind==='dm'?[req.user.id,selected[0].id].sort().join(':'):null;
   if(dmKey){const existing=await first('SELECT id FROM rooms WHERE dm_key=$1',[dmKey]);if(existing)return res.json(existing);}
   await db.query("INSERT INTO rooms(id,name,kind,owner_id,server_id,category_id,dm_key,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[roomId,x.name,x.kind,req.user.id,x.server_id||null,x.category_id||null,dmKey,x.kind==='temporary'?new Date(Date.now()+24*3600_000):null]);
   for(const u of [req.user,...selected])await db.query('INSERT INTO room_members(room_id,user_id) VALUES($1,$2)',[roomId,u.id]);refresh();res.json({id:roomId});
 }));
 app.patch('/api/rooms/:id',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id),'manage_channels');const x=z.object({name:label}).parse(req.body);await db.query('UPDATE rooms SET name=$2 WHERE id=$1',[room.id,x.name]);refresh();res.json({ok:true});}));
 app.delete('/api/rooms/:id',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id),'manage_channels');await db.query('DELETE FROM rooms WHERE id=$1',[room.id]);await evictRoom(room.id);refresh();res.json({ok:true});}));
 app.post('/api/rooms/:id/members',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id),'manage_members');if(room.server_id||room.kind==='dm')fail(400,'Use a comunidade ou um grupo');const x=z.object({username}).parse(req.body);const u=await first('SELECT * FROM users WHERE username=$1',[x.username]);if(!u||await blocked(req.user.id,u.id)||u.dm_policy==='nobody'||u.dm_policy==='friends'&&!await friends(req.user.id,u.id))fail(403,'Não é possível adicionar este usuário');if((await members(room)).length>=16)fail(400,'Limite de 16 membros');await db.query('INSERT INTO room_members(room_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[room.id,u.id]);refresh();res.json({ok:true});}));
 app.delete('/api/rooms/:id/members/:user',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id));const target=id.parse(req.params.user);if(room.server_id||room.kind==='dm'||target===room.owner_id)fail(400,'Não é possível remover este membro');if(target!==req.user.id&&room.owner_id!==req.user.id)fail(403,'Sem permissão');await db.query('DELETE FROM room_members WHERE room_id=$1 AND user_id=$2',[room.id,target]);await evictRoom(room.id,target);refresh();res.json({ok:true});}));
 app.post('/api/servers',route(async(req,res)=>{const name=label.parse(req.body.name);const server=uid();await db.query('INSERT INTO servers(id,name,owner_id) VALUES($1,$2,$3)',[server,name,req.user.id]);await db.query('INSERT INTO server_members(server_id,user_id) VALUES($1,$2)',[server,req.user.id]);const category=uid();await db.query('INSERT INTO categories(id,server_id,name) VALUES($1,$2,$3)',[category,server,'CONVERSAS']);for(const [name,kind] of [['geral','text'],['Sala de encontro','voice']])await db.query('INSERT INTO rooms(id,name,kind,owner_id,server_id,category_id) VALUES($1,$2,$3,$4,$5,$6)',[uid(),name,kind,req.user.id,server,category]);refresh();res.json({id:server});}));
 app.get('/api/servers/:id/manage',route(async(req,res)=>{const s=await serverAccess(req.user.id,String(req.params.id));const ms=await db.query('SELECT m.*,u.username,u.display_name FROM server_members m JOIN users u ON u.id=m.user_id WHERE server_id=$1',[s.id]);const roles=await db.query('SELECT * FROM roles WHERE server_id=$1',[s.id]);const audit=s.owner_id===req.user.id?await db.query('SELECT * FROM audit WHERE server_id=$1 ORDER BY created_at DESC LIMIT 30',[s.id]):[];res.json({members:ms,roles,audit});}));
 app.post('/api/servers/:id/categories',route(async(req,res)=>{const s=await serverAccess(req.user.id,String(req.params.id),'manage_channels');await db.query('INSERT INTO categories(id,server_id,name) VALUES($1,$2,$3)',[uid(),s.id,label.parse(req.body.name)]);refresh();res.json({ok:true});}));
 app.post('/api/servers/:id/roles',route(async(req,res)=>{const s=await serverAccess(req.user.id,String(req.params.id),'manage_roles');if(s.owner_id!==req.user.id)fail(403,'Somente o dono pode conceder permissões');const x=z.object({name:label,permissions:z.array(z.enum(permissions)).max(6)}).parse(req.body);await db.query('INSERT INTO roles(id,server_id,name,permissions) VALUES($1,$2,$3,$4)',[uid(),s.id,x.name,JSON.stringify(x.permissions)]);refresh();res.json({ok:true});}));
 app.patch('/api/servers/:id/members/:user',route(async(req,res)=>{const s=await serverAccess(req.user.id,String(req.params.id),'manage_members');const target=id.parse(req.params.user);const x=z.object({action:z.enum(['role','kick','ban','unban']),role_id:id.nullable().optional()}).parse(req.body);if(target===s.owner_id||target===req.user.id)fail(403,'Não é possível moderar este membro');if(s.owner_id!==req.user.id){const m=await first('SELECT role_id FROM server_members WHERE server_id=$1 AND user_id=$2',[s.id,target]);if(x.action==='role'||m?.role_id)fail(403,'Somente o dono pode gerenciar cargos e moderadores');}
   if(x.action==='role'){if(x.role_id&&!await first('SELECT 1 FROM roles WHERE id=$1 AND server_id=$2',[x.role_id,s.id]))fail(400,'Cargo inválido');await db.query('UPDATE server_members SET role_id=$3 WHERE server_id=$1 AND user_id=$2',[s.id,target,x.role_id||null]);}
   else if(x.action==='kick')await db.query('DELETE FROM server_members WHERE server_id=$1 AND user_id=$2',[s.id,target]);
   else await db.query('UPDATE server_members SET banned=$3 WHERE server_id=$1 AND user_id=$2',[s.id,target,x.action==='ban']);
   await db.query('INSERT INTO audit(id,server_id,actor_id,action) VALUES($1,$2,$3,$4)',[uid(),s.id,req.user.id,`${x.action}: ${target}`]);for(const r of await db.query('SELECT id FROM rooms WHERE server_id=$1',[s.id]))await evictRoom(r.id,target);refresh();res.json({ok:true});
 }));
 app.post('/api/servers/:id/invites',route(async(req,res)=>{const s=await serverAccess(req.user.id,String(req.params.id),'invite');const code=randomBytes(18).toString('base64url');await db.query("INSERT INTO invites(code,server_id,creator_id,expires_at) VALUES($1,$2,$3,now()+interval '7 days')",[code,s.id,req.user.id]);res.json({code,expires:'7 dias',max_uses:25});}));
 app.post('/api/invites/:code/join',route(async(req,res)=>{const code=z.string().max(64).parse(req.params.code);const inv=await first('SELECT * FROM invites WHERE code=$1',[code]);if(!inv)fail(404,'Convite inválido');const m=await first('SELECT * FROM server_members WHERE server_id=$1 AND user_id=$2',[inv.server_id,req.user.id]);if(m?.banned)fail(403,'Você foi banido desta comunidade');if(m)return res.json({id:inv.server_id});const valid=await first('UPDATE invites SET uses=uses+1 WHERE code=$1 AND expires_at>now() AND uses<max_uses RETURNING *',[code]);if(!valid)fail(400,'Convite expirado ou esgotado');await db.query('INSERT INTO server_members(server_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[inv.server_id,req.user.id]);refresh();res.json({id:inv.server_id});}));
 app.get('/api/rooms/:id/messages',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id));const before=req.query.before?z.iso.datetime({offset:true}).parse(req.query.before):new Date().toISOString();const messages=await db.query(`SELECT m.*,u.username,u.display_name,u.avatar_id,a.name AS attachment_name,a.mime AS attachment_mime,a.size AS attachment_size,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('emoji',r.emoji,'user_id',r.user_id)) FROM reactions r WHERE r.message_id=m.id),'[]') AS reactions
     FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN attachments a ON a.id=m.attachment_id WHERE m.room_id=$1 AND m.created_at<$2 AND NOT EXISTS(SELECT 1 FROM relations b WHERE b.state='blocked' AND (b.sender=$3 AND b.recipient=m.user_id OR b.recipient=$3 AND b.sender=m.user_id)) ORDER BY m.created_at DESC LIMIT 60`,[room.id,before,req.user.id]);const readers=await db.query('SELECT rm.user_id,rm.last_read_at FROM room_members rm JOIN users u ON u.id=rm.user_id WHERE rm.room_id=$1 AND u.read_receipts',[room.id]);res.json({messages:messages.reverse(),readers,members:await members(room)});}));
 const sendLimit=rateLimit({windowMs:10_000,limit:12,keyGenerator:req=>(req as AuthRequest).user.id,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Você está enviando mensagens rápido demais.'}});
 app.post('/api/rooms/:id/messages',sendLimit,route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id),'send');const x=messageInput.parse(req.body);if(x.reply_id&&!await first('SELECT 1 FROM messages WHERE id=$1 AND room_id=$2',[x.reply_id,room.id]))fail(400,'Resposta inválida');if(x.attachment_id&&!await first('SELECT 1 FROM attachments WHERE id=$1 AND owner_id=$2 AND room_id=$3',[x.attachment_id,req.user.id,room.id]))fail(400,'Anexo inválido');const mid=uid();await db.query('INSERT INTO messages(id,room_id,user_id,body,reply_id,attachment_id) VALUES($1,$2,$3,$4,$5,$6)',[mid,room.id,req.user.id,x.body,x.reply_id||null,x.attachment_id||null]);for(const m of await members(room)){const u=await first('SELECT username FROM users WHERE id=$1',[m.user_id]);const mention=new RegExp('(^|\\s)@'+u.username+'(?=\\s|$|[.,!?])').test(x.body);const muted=await first('SELECT muted FROM room_members WHERE room_id=$1 AND user_id=$2',[room.id,m.user_id]);if(!muted?.muted&&(mention||!room.server_id))await notify(m.user_id,req.user.id,`${req.user.display_name}: ${x.body.slice(0,100)||'Enviou um anexo'}`,room.id);}refresh();res.json({id:mid});}));
 app.patch('/api/messages/:id',route(async(req,res)=>{const m=await first('SELECT * FROM messages WHERE id=$1',[id.parse(req.params.id)]);if(!m)fail(404,'Mensagem não encontrada');await access(req.user.id,m.room_id,'send');if(m.user_id!==req.user.id||m.deleted)fail(403,'Você só pode editar suas mensagens');const body=z.string().trim().min(1).max(4000).parse(req.body.body);await db.query('UPDATE messages SET body=$2,edited_at=now() WHERE id=$1',[m.id,body]);refresh();res.json({ok:true});}));
 app.delete('/api/messages/:id',route(async(req,res)=>{const m=await first('SELECT * FROM messages WHERE id=$1',[id.parse(req.params.id)]);if(!m)fail(404,'Mensagem não encontrada');const room=await access(req.user.id,m.room_id,m.user_id===req.user.id?undefined:'manage_messages');await db.query("UPDATE messages SET body='',deleted=true,attachment_id=NULL WHERE id=$1",[m.id]);await db.query('DELETE FROM reactions WHERE message_id=$1',[m.id]);if(room.server_id)await db.query('INSERT INTO audit(id,server_id,actor_id,action) VALUES($1,$2,$3,$4)',[uid(),room.server_id,req.user.id,`delete_message: ${m.id}`]);refresh();res.json({ok:true});}));
 app.post('/api/messages/:id/reactions',route(async(req,res)=>{const m=await first('SELECT * FROM messages WHERE id=$1 AND NOT deleted',[id.parse(req.params.id)]);if(!m)fail(404,'Mensagem não encontrada');await access(req.user.id,m.room_id,'send');if(await blocked(req.user.id,m.user_id))fail(403,'Usuário bloqueado');const emoji=z.enum(['👍','💜','😂','🎉','👀','🔥']).parse(req.body.emoji);const old=await db.query('DELETE FROM reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3 RETURNING *',[m.id,req.user.id,emoji]);if(!old.length)await db.query('INSERT INTO reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[m.id,req.user.id,emoji]);refresh();res.json({ok:true});}));
 app.post('/api/rooms/:id/read',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id));await db.query('INSERT INTO room_members(room_id,user_id,last_read_at) VALUES($1,$2,now()) ON CONFLICT(room_id,user_id) DO UPDATE SET last_read_at=now()',[room.id,req.user.id]);await db.query('UPDATE notifications SET read=true WHERE user_id=$1 AND room_id=$2',[req.user.id,room.id]);if(req.user.read_receipts)io.to('room:'+room.id).emit('read',{user_id:req.user.id,at:new Date().toISOString()});res.json({ok:true});}));
 app.post('/api/rooms/:id/mute',route(async(req,res)=>{const room=await access(req.user.id,String(req.params.id));const muted=z.boolean().parse(req.body.muted);await db.query('INSERT INTO room_members(room_id,user_id,muted) VALUES($1,$2,$3) ON CONFLICT(room_id,user_id) DO UPDATE SET muted=$3',[room.id,req.user.id,muted]);refresh();res.json({ok:true});}));
 app.post('/api/notifications/read',route(async(req,res)=>{await db.query('UPDATE notifications SET read=true WHERE user_id=$1',[req.user.id]);refresh();res.json({ok:true});}));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024,files:1,fields:0}});
 app.post('/api/upload',rateLimit({windowMs:3600_000,limit:30,keyGenerator:req=>(req as AuthRequest).user.id}),upload.single('file'),route(async(req,res)=>{
   const file=req.file;if(!file)fail(400,'Selecione um arquivo');const room=req.query.room?id.parse(req.query.room):null;if(room)await access(req.user.id,room,'send');const b=file.buffer;
   let mime='';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(b[0]===255&&b[1]===216&&b[2]===255)mime='image/jpeg';else if(['GIF87a','GIF89a'].includes(b.subarray(0,6).toString()))mime='image/gif';else if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')mime='image/webp';else if(b.subarray(0,5).toString()==='%PDF-')mime='application/pdf';else if(b.subarray(4,8).toString()==='ftyp')mime='video/mp4';else if(b.subarray(0,4).equals(Buffer.from([26,69,223,163])))mime='video/webm';else if(b.subarray(0,3).toString()==='ID3')mime='audio/mpeg';
   if(!mime||(!room&&!mime.startsWith('image/')))fail(400,'Formatos aceitos: PNG, JPG, GIF, WebP, PDF, MP4, WebM e MP3 (ID3). Avatar deve ser imagem.');if(!room&&file.size>2*1024*1024)fail(400,'Avatar: máximo de 2 MB');
   const aid=uid();await mkdir(path.join(dataDir,'uploads'),{recursive:true});await writeFile(path.join(dataDir,'uploads',aid),b);try{await db.query('INSERT INTO attachments(id,owner_id,room_id,name,mime,size) VALUES($1,$2,$3,$4,$5,$6)',[aid,req.user.id,room,path.basename(file.originalname).slice(0,120),mime,file.size]);}catch(e){await unlink(path.join(dataDir,'uploads',aid));throw e;}res.json({id:aid,name:file.originalname,mime});
 }));
 app.get('/api/files/:id',route(async(req,res)=>{const a=await first('SELECT * FROM attachments WHERE id=$1',[id.parse(req.params.id)]);if(!a)fail(404,'Arquivo não encontrado');if(a.room_id){await access(req.user.id,a.room_id);if(await blocked(req.user.id,a.owner_id))fail(403,'Arquivo indisponível');if(a.owner_id!==req.user.id&&!await first('SELECT 1 FROM messages WHERE attachment_id=$1 AND NOT deleted',[a.id]))fail(403,'Arquivo não publicado');}else if(a.owner_id!==req.user.id&&!await first('SELECT 1 FROM users WHERE avatar_id=$1 OR banner_id=$1',[a.id]))fail(403,'Arquivo privado');res.setHeader('Cache-Control','private, no-store');res.type(a.mime);if(!a.mime.startsWith('image/'))res.attachment(a.name);res.send(await readFile(path.join(dataDir,'uploads',a.id)));}));
 app.get('/api/rtc-config',(_req,res)=>{const iceServers=JSON.parse(process.env.ICE_SERVERS||'[{"urls":"stun:stun.l.google.com:19302"}]');const turnConfigured=iceServers.some((s:any)=>[s.urls].flat().some((u:string)=>/^turns?:/.test(u)));res.json({iceServers,maxPeers:6,turnConfigured});});

 async function evictRoom(room:string,user?:string) { for(const s of io.sockets.sockets.values()){if(user&&s.data.user.id!==user)continue;if(s.data.call===room)await leaveCall(s);await s.leave('room:'+room);s.emit('access-changed');} }
 async function leaveCall(s:any){const room=s.data.call;if(room){await rings.cancelSocket(s.id);s.to('call:'+room).emit('call-left',{peer:s.id,room});await s.leave('call:'+room);s.data.call=null;s.emit('call-ended',{room,token:s.data.callToken});}}
 io.use(async(s,next)=>{try{const u=await authenticate(s.request.headers.cookie);if(!u)return next(new Error('Sessão inválida'));s.data.user=u;s.data.session=u.session_id;next();}catch{next(new Error('Sessão inválida'));}});
 io.on('connection',s=>{
   s.join('user:'+s.data.user.id);for(const ring of rings.sync(s.data.user.id))s.emit('ring-incoming',ring);refresh();let count=0;let reset=Date.now();
   s.use(async(_packet,next)=>{try{if(Date.now()-reset>10_000){count=0;reset=Date.now();}if(++count>150)throw new Error('Limite de eventos excedido');const u=await authenticate(s.request.headers.cookie);if(!u){s.disconnect(true);return;}s.data.user=u;next();}catch(e){next(e as Error);}});
   const event=(name:string,handler:(p:any)=>Promise<any>)=>s.on(name,async(p,ack)=>{try{const execute=async()=>{if(!s.connected)fail(401,'Conexão encerrada');return handler(p);};const result=await (['call-join','call-leave'].includes(name)?serializeCall(execute):execute());if(typeof ack==='function')ack({ok:true,...result});}catch(e:any){if(typeof ack==='function')ack({ok:false,error:e.message});}});
   event('watch',async(p)=>{const r=await access(s.data.user.id,id.parse(p.room));for(const old of s.rooms)if(old.startsWith('room:'))await s.leave(old);await s.join('room:'+r.id);return {};});
   event('typing',async(p)=>{const r=await access(s.data.user.id,id.parse(p.room),'send');s.to('room:'+r.id).emit('typing',{room:r.id,user_id:s.data.user.id,name:s.data.user.display_name});return {};});
   event('call-join',async(p)=>{const r=await access(s.data.user.id,id.parse(p.room));const peers=[...io.sockets.sockets.values()].filter(x=>x.data.call===r.id&&x.id!==s.id);if(peers.length>=6)fail(400,'Sala cheia: até 6 participantes');for(const peer of peers)if(await blocked(peer.data.user.id,s.data.user.id))fail(403,'Chamada indisponível por bloqueio');await leaveCall(s);s.data.call=r.id;s.data.callToken=p.token===undefined?undefined:id.parse(p.token);s.data.media={mic:false,camera:false,screen:false,screenAudio:false,deaf:false};await s.join('call:'+r.id);await rings.joined(s.data.user.id,r.id);return {peers:peers.map(x=>({id:x.id,name:x.data.user.display_name,user_id:x.data.user.id,media:x.data.media}))};});
   event('signal',async(p)=>{const x=z.object({to:z.string().max(64),description:z.object({type:z.enum(['offer','answer']),sdp:z.string().max(50000)}).optional(),candidate:z.any().optional(),restart:z.boolean().optional()}).parse(p);const target=io.sockets.sockets.get(x.to);if(!s.data.call||!target||target.data.call!==s.data.call)fail(403,'Sinalização fora da chamada');await access(s.data.user.id,s.data.call);await access(target.data.user.id,s.data.call);target.emit('signal',{from:s.id,name:s.data.user.display_name,user_id:s.data.user.id,media:s.data.media,description:x.description,candidate:x.candidate,restart:x.restart});return {};});
   event('call-state',async(p)=>{if(!s.data.call)fail(403,'Entre em uma chamada');await access(s.data.user.id,s.data.call);s.data.media=z.object({mic:z.boolean(),camera:z.boolean(),screen:z.boolean(),screenAudio:z.boolean(),deaf:z.boolean()}).parse(p);s.to('call:'+s.data.call).emit('call-state',{peer:s.id,user_id:s.data.user.id,media:s.data.media});return {};});
   event('call-leave',async(p)=>{if((!p?.room||p.room===s.data.call)&&(!p?.token||p.token===s.data.callToken))await leaveCall(s);return {};});
   s.on('disconnect',()=>{void serializeCall(()=>leaveCall(s)).catch(console.error);refresh();});
 });
 const ringSweep=setInterval(()=>{void rings.expire().catch(console.error);},1000);ringSweep.unref();
 const sweep=setInterval(()=>{void (async()=>{for(const s of io.sockets.sockets.values()){if(!await authenticate(s.request.headers.cookie)){s.disconnect(true);continue;}if(s.data.call)try{await access(s.data.user.id,s.data.call);}catch{await leaveCall(s);}}await db.query('DELETE FROM sessions WHERE expires_at<now()');await db.query('DELETE FROM rooms WHERE expires_at<now()');})().catch(console.error);},30_000);sweep.unref();
 app.use(express.static(path.join(root,'apps/web/dist')));
 app.get('/{*path}',(req,res,next)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Rota não encontrada'});res.sendFile(path.join(root,'apps/web/dist/index.html'),e=>{if(e)next(e);});});
 app.use((err:any,_req:Request,res:Response,_next:NextFunction)=>{if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(x=>x.message).join('; ')});if(err.code==='23505')return res.status(409).json({error:'Já existe um registro com esses dados'});if(err instanceof multer.MulterError)return res.status(400).json({error:'Arquivo inválido ou maior que 10 MB'});if(err.code==='23503')return res.status(400).json({error:'Referência inválida'});if(err.status)return res.status(err.status).json({error:err.message});console.error(err);res.status(500).json({error:'Falha interna. Tente novamente.'});});
 return {app,http,io,close:async()=>{clearInterval(sweep);clearInterval(ringSweep);await new Promise<void>(resolve=>io.close(()=>resolve()));await db.close();}};
}
