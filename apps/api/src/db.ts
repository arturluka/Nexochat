import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
export const root = fileURLToPath(new URL('../../../', import.meta.url));
dotenv.config({path:path.join(root,'.env'),quiet:true});
export const dataDir = path.resolve(root,process.env.DATA_DIR || 'data');
export interface QueryDb { query<T = any>(sql:string,args?:any[]):Promise<T[]> }
export async function openDb() {
  await mkdir(dataDir,{recursive:true});
  const client = process.env.DATABASE_URL ? new pg.Pool({connectionString:process.env.DATABASE_URL}) : new PGlite(path.join(dataDir,'postgres'));
  return {
    async query<T = any>(sql:string, args:any[] = []):Promise<T[]> { return client instanceof PGlite ? (await client.query(sql,args)).rows as T[] : (await client.query(sql,args)).rows as T[]; },
    async exec(sql:string) { if(client instanceof PGlite) await client.exec(sql); else await client.query(sql); },
    async transaction<T>(fn:(tx:QueryDb)=>Promise<T>):Promise<T> {
      if(client instanceof PGlite)return client.transaction(async tx=>fn({query:async<R=any>(sql:string,args:any[]=[]) => (await tx.query(sql,args)).rows as R[]}));
      const connection=await client.connect();
      try{await connection.query('BEGIN');const result=await fn({query:async<R=any>(sql:string,args:any[]=[]) => (await connection.query(sql,args)).rows as R[]});await connection.query('COMMIT');return result;}
      catch(error){await connection.query('ROLLBACK');throw error;}finally{connection.release();}
    },
    async close() { if(client instanceof PGlite) await client.close(); else await client.end(); }
  };
}
export type DB = Awaited<ReturnType<typeof openDb>>;
