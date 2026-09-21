import { readFile } from 'node:fs/promises';
import { openDb, type DB } from './db.js';
export async function migrate(db:DB) { await db.exec(await readFile(new URL('./schema.sql',import.meta.url),'utf8')); }
if (process.argv[1]?.endsWith('migrate.ts')) { const db = await openDb(); await migrate(db); await db.close(); console.log('Migration 1 aplicada.'); }
