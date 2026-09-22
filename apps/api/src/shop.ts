import type {DB} from './db.js';
import {randomUUID} from 'node:crypto';
function fail(status:number,message:string):never{throw Object.assign(new Error(message),{status});}
export function shopService(db:DB){return {
 async view(user:string){const [wallet]=await db.query('SELECT sparks,equipped_frame FROM users WHERE id=$1',[user]);const items=await db.query('SELECT s.*,i.acquired_at FROM shop_items s LEFT JOIN inventory i ON i.item_id=s.id AND i.user_id=$1 ORDER BY s.price',[user]);const claimed=await db.query("SELECT 1 FROM daily_rewards WHERE user_id=$1 AND reward_day=(now() AT TIME ZONE 'UTC')::date",[user]);const ledger=await db.query('SELECT amount,reason,created_at FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[user]);return {...wallet,items,ledger,daily_available:!claimed.length,daily_amount:100,next_reset:new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()+1)).toISOString()};},
 async daily(user:string){return db.transaction(async tx=>{
  await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);
  const claimed=await tx.query("INSERT INTO daily_rewards(user_id,reward_day) VALUES($1,(now() AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING RETURNING user_id",[user]);if(!claimed.length)fail(409,'Você já resgatou as Faíscas de hoje.');
  const [wallet]=await tx.query('UPDATE users SET sparks=sparks+100 WHERE id=$1 RETURNING sparks',[user]);await tx.query('INSERT INTO wallet_ledger(id,user_id,amount,reason) VALUES($1,$2,100,$3)',[randomUUID(),user,'Presente diário']);return wallet;
 });},
 async buy(user:string,item:string){return db.transaction(async tx=>{
  await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[user]);
  const [product]=await tx.query('SELECT * FROM shop_items WHERE id=$1',[item]);if(!product)fail(404,'Moldura não encontrada');if((await tx.query('SELECT 1 FROM inventory WHERE user_id=$1 AND item_id=$2',[user,item])).length)fail(409,'Você já tem essa moldura');
  const [wallet]=await tx.query('UPDATE users SET sparks=sparks-$2 WHERE id=$1 AND sparks>=$2 RETURNING sparks',[user,product.price]);if(!wallet)fail(400,'Faíscas insuficientes. Resgate o presente diário para juntar mais.');
  await tx.query('INSERT INTO inventory(user_id,item_id) VALUES($1,$2)',[user,item]);await tx.query('INSERT INTO wallet_ledger(id,user_id,amount,reason) VALUES($1,$2,$3,$4)',[randomUUID(),user,-product.price,'Moldura: '+product.name]);return wallet;
 });},
 async equip(user:string,item:string|null){if(item&&!(await db.query('SELECT 1 FROM inventory WHERE user_id=$1 AND item_id=$2',[user,item])).length)fail(403,'Adquira a moldura antes de equipar.');await db.query('UPDATE users SET equipped_frame=$2 WHERE id=$1',[user,item]);return {ok:true};}
};}
