import {z} from 'zod';
export function rtcSettings(env:NodeJS.ProcessEnv=process.env){
 try{
  const url=z.string().max(500).regex(/^(stun|stuns|turn|turns):[^\s]+$/);
  const iceServers=z.array(z.object({urls:z.union([url,z.array(url).min(1).max(8)]),username:z.string().min(1).max(500).optional(),credential:z.string().min(1).max(1000).optional()}).strict()).max(12).parse(JSON.parse(env.ICE_SERVERS||'[{"urls":"stun:stun.l.google.com:19302"}]'));
  const turns=iceServers.filter(s=>[s.urls].flat().some(u=>/^turns?:/.test(u)));
  if(turns.some(s=>!s.username||!s.credential))throw new Error();
  const iceTransportPolicy=z.enum(['all','relay']).parse(env.ICE_TRANSPORT_POLICY||'all');
  if(iceTransportPolicy==='relay'&&!turns.length)throw new Error();
  return {iceServers,iceTransportPolicy,maxPeers:6,turnConfigured:turns.length>0};
 }catch{throw Object.assign(new Error('Configuração de chamadas inválida. Confira ICE_SERVERS (JSON com URLs e credenciais TURN) e ICE_TRANSPORT_POLICY (all ou relay) no servidor.'),{status:503});}
}
