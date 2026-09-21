import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { openDb } from './db.js';
import { migrate } from './migrate.js';
const db=await openDb();await migrate(db);
const password=process.env.SEED_PASSWORD;
if(!password||password.length<10)throw new Error('Defina SEED_PASSWORD (mínimo 10 caracteres) no .env.');
for(const name of ['aurora','leo']){if((await db.query('SELECT id FROM users WHERE username=$1',[name])).length)continue;await db.query("INSERT INTO users(id,username,password_hash,display_name,dm_policy) VALUES($1,$2,$3,$4,'everyone')",[randomUUID(),name,await argon2.hash(password,{type:argon2.argon2id}),name==='aurora'?'Aurora':'Léo']);}
await db.close();console.log('Contas aurora e leo prontas. Senha definida por SEED_PASSWORD.');
