import { readFile } from 'node:fs/promises';
import { openDb, type DB } from './db.js';
export async function migrate(db:DB) {
 await db.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=2')).length) await db.exec(await readFile(new URL('./migrations/002_profiles.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=3')).length) await db.exec(await readFile(new URL('./migrations/003_shop_calls.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=4')).length) await db.exec(await readFile(new URL('./migrations/004_badges.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=5')).length) await db.exec(await readFile(new URL('./migrations/005_community.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=6')).length) await db.exec(await readFile(new URL('./migrations/006_everyday.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=7')).length) await db.exec(await readFile(new URL('./migrations/007_community_plus.sql',import.meta.url),'utf8'));
 if(!(await db.query('SELECT version FROM migrations WHERE version=8')).length) await db.exec(await readFile(new URL('./migrations/008_personal_space.sql',import.meta.url),'utf8'));
}
if (process.argv[1]?.endsWith('migrate.ts')) { const db = await openDb(); await migrate(db); await db.close(); console.log('Migrations aplicadas.'); }
