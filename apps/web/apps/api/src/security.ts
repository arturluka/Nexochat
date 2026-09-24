import * as OTPAuth from 'otpauth';
import argon2 from 'argon2';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import type {DB,QueryDb} from './db.js';
const fail=(status:number,message:string):never=>{throw Object.assign(new Error(message),{status});};
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const proof=z.object({password:z.string().min(10).max(128),otp:z.string().max(128).optional()});
export function securityService(db:DB){
 const totp=(secret:string,label='NexoChat')=>new OTPAuth.TOTP({issuer:'NexoChat',label,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)});
 async function factor(tx:QueryDb,user:string,token?:string){
  const [s]=await tx.query('SELECT * FROM account_security WHERE user_id=$1 FOR UPDATE',[user]);if(!s?.totp_secret)return;
  if(!token)fail(401,'Informe o código do autenticador ou um código de recuperação.');
  const clean=token!.replace(/[\s-]/g,'');
  if(/^\d{6}$/.test(clean)){const delta=totp(s.totp_secret).validate({token:clean,window:1});const counter=Math.floor(Date.now()/30000)+(delta??0);if(delta===null||counter<=Number(s.last_counter))fail(401,'Código inválido ou já utilizado. Aguarde o próximo código.');await tx.query('UPDATE account_security SET last_counter=$2 WHERE user_id=$1',[user,counter]);}
  else if(!(await tx.query('DELETE FROM recovery_codes WHERE user_id=$1 AND code_hash=$2 RETURNING user_id',[user,digest(clean)])).length)fail(401,'Código de recuperação inválido ou utilizado.');
 }
 async function reauth(tx:QueryDb,user:string,body:any){const x=proof.parse(body);const [u]=await tx.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[user]);if(!u||!await argon2.verify(u.password_hash,x.password))fail(401,'Senha incorreta.');await factor(tx,user,x.otp);return u;}
 async function codes(tx:QueryDb,user:string){const values=Array.from({length:8},()=>randomBytes(20).toString('hex'));await tx.query('DELETE FROM recovery_codes WHERE user_id=$1',[user]);for(const c of values)await tx.query('INSERT INTO recovery_codes(user_id,code_hash) VALUES($1,$2)',[user,digest(c)]);return values;}
 function publicRoutes({app,route,loginLimit,disconnectUser}:any){
  app.post('/api/auth/recover',loginLimit,route(async(req:any,res:any)=>{const x=z.object({username:z.string().trim().toLowerCase().max(24),code:z.string().min(20).max(128),password:z.string().min(10).max(128)}).parse(req.body);const passwordHash=await argon2.hash(x.password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});const user=await db.transaction(async tx=>{const [u]=await tx.query('SELECT id FROM users WHERE username=$1 FOR UPDATE',[x.username]);if(!u||!(await tx.query('DELETE FROM recovery_codes WHERE user_id=$1 AND code_hash=$2 RETURNING user_id',[u.id,digest(x.code.replace(/[\s-]/g,''))])).length)fail(401,'Usuário ou código de recuperação inválido.');await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1',[u.id,passwordHash]);await tx.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);await tx.query('DELETE FROM account_security WHERE user_id=$1',[u.id]);await tx.query('DELETE FROM recovery_codes WHERE user_id=$1',[u.id]);return u.id;});disconnectUser(user);res.json({ok:true});}));
 }
 function privateRoutes({app,route}:any){
  app.get('/api/security',route(async(req:any,res:any)=>{const [s]=await db.query('SELECT totp_secret IS NOT NULL AS enabled FROM account_security WHERE user_id=$1',[req.user.id]);const [c]=await db.query('SELECT count(*)::int AS count FROM recovery_codes WHERE user_id=$1',[req.user.id]);res.json({enabled:!!s?.enabled,recovery_remaining:c.count});}));
  app.post('/api/security/recovery',route(async(req:any,res:any)=>res.json({codes:await db.transaction(async tx=>{await reauth(tx,req.user.id,req.body);return codes(tx,req.user.id);})})));
  app.post('/api/security/setup',route(async(req:any,res:any)=>{const data=await db.transaction(async tx=>{const u=await reauth(tx,req.user.id,req.body);const [s]=await tx.query('SELECT totp_secret FROM account_security WHERE user_id=$1',[u.id]);if(s?.totp_secret)fail(409,'Desative o autenticador atual antes de cadastrar outro.');const t=new OTPAuth.TOTP({issuer:'NexoChat',label:u.username,secret:new OTPAuth.Secret({size:20})});await tx.query("INSERT INTO account_security(user_id,pending_secret,pending_until) VALUES($1,$2,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET pending_secret=$2,pending_until=now()+interval '10 minutes'",[u.id,t.secret.base32]);return {secret:t.secret.base32,uri:t.toString()};});res.json(data);}));
  app.post('/api/security/confirm',route(async(req:any,res:any)=>{const result=await db.transaction(async tx=>{await reauth(tx,req.user.id,req.body);const [s]=await tx.query('SELECT * FROM account_security WHERE user_id=$1 FOR UPDATE',[req.user.id]);if(!s?.pending_secret||new Date(s.pending_until).getTime()<Date.now())fail(400,'Configuração expirada. Comece novamente.');const token=z.string().regex(/^\d{6}$/).parse(req.body.otp);const delta=totp(s.pending_secret).validate({token,window:1});if(delta===null)fail(401,'Código incorreto.');await tx.query('UPDATE account_security SET totp_secret=pending_secret,pending_secret=NULL,pending_until=NULL,last_counter=$2 WHERE user_id=$1',[req.user.id,Math.floor(Date.now()/30000)+(delta??0)]);return {codes:await codes(tx,req.user.id)};});res.json(result);}));
  app.post('/api/security/disable',route(async(req:any,res:any)=>{await db.transaction(async tx=>{await reauth(tx,req.user.id,req.body);await tx.query('DELETE FROM account_security WHERE user_id=$1',[req.user.id]);});res.json({ok:true});}));
 }
 return {publicRoutes,privateRoutes,login:async(user:string,otp?:string)=>db.transaction(tx=>factor(tx,user,otp))};
}

