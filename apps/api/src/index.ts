import { openDb } from './db.js';
import { migrate } from './migrate.js';
import { createApp } from './app.js';
const db=await openDb();await migrate(db);
const service=createApp(db);
const port=Number(process.env.PORT||3001);
service.http.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`NexoChat API: http://localhost:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{void service.close().then(()=>process.exit(0));});
