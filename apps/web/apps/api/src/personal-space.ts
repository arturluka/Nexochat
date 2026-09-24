import {z} from 'zod';
const id=z.string().uuid();
export function personalSpace({app,db,route,serverAccess}:any){
 app.get('/api/community-layout',route(async(req:any,res:any)=>res.json(req.user.community_layout)));
 app.put('/api/community-layout',route(async(req:any,res:any)=>{
  const x=z.object({folders:z.array(z.object({id,name:z.string().trim().min(1).max(30),servers:z.array(id).max(200)}).strict()).max(20),order:z.array(id).max(200)}).strict().parse(req.body);
  const members=new Set((await db.query('SELECT server_id FROM server_members WHERE user_id=$1 AND NOT banned',[req.user.id])).map((r:any)=>r.server_id));
  const unique=new Set<string>();
  for(const f of x.folders){if(unique.has(f.id))throw Object.assign(new Error('Pastas duplicadas'),{status:400});unique.add(f.id);}
  const used=new Set<string>();
  for(const f of x.folders)f.servers=f.servers.filter(s=>{if(!members.has(s)||used.has(s))return false;used.add(s);return true;});
  x.order=[...new Set(x.order)].filter(s=>members.has(s));
  await db.query('UPDATE users SET community_layout=$2 WHERE id=$1',[req.user.id,JSON.stringify(x)]);res.json(x);
 }));
 app.get('/api/my-reports',route(async(req:any,res:any)=>{
  const rows=await db.query('SELECT r.id,r.server_id,r.reason,r.status,r.decision,r.created_at,r.decided_at,s.name AS server_name FROM reports r JOIN servers s ON s.id=r.server_id WHERE r.reporter_id=$1 ORDER BY r.created_at DESC LIMIT 100',[req.user.id]);
  const visible=[];for(const r of rows)try{await serverAccess(req.user.id,r.server_id);visible.push(r);}catch(e:any){if(![403,404].includes(e.status))throw e;}
  res.json(visible);
 }));
}
