import type {Socket} from 'socket.io-client';
import {api} from './api';
export type JoinMode='voice'|'listen'|'companion';
export type MediaState={mic:boolean;camera:boolean;screen:boolean;screenAudio:boolean;deaf:boolean};
export type RemotePeer={id:string;name:string;user_id:string;pc:RTCPeerConnection;camera:MediaStream;screen:MediaStream;audio:MediaStream;screenAudio:MediaStream;media:MediaState;connection:string;initiator:boolean;retries:number;audioReceived:number;audioSent:number;audioReceiving:boolean;audioSending:boolean;route:string;pending:RTCIceCandidateInit[];queue:Promise<void>};
const emptyMedia=():MediaState=>({mic:false,camera:false,screen:false,screenAudio:false,deaf:false});
// Permanent slots: microphone, camera, screen video, screen audio. Even listeners
// negotiate sendrecv slots, so enabling a device later only needs replaceTrack.
export class CallEngine {
 private readonly token=crypto.randomUUID();
 readonly peers=new Map<string,RemotePeer>();
 readonly tracks:(MediaStreamTrack|null)[]=[null,null,null,null];
 media=emptyMedia(); turnConfigured=false; ready=false; disposed=false; note='';
 private config:RTCConfiguration={}; private joined=false;private joining=false;
 constructor(readonly socket:Socket,readonly room:string,readonly mode:JoinMode,readonly changed:()=>void,readonly error:(message:string)=>void,readonly ended:()=>void){this.media.deaf=mode==='companion';}
 private emit(name:string,data:any):Promise<any>{return new Promise((resolve,reject)=>this.socket.timeout(7000).emit(name,data,(error:any,r:any)=>error?reject(new Error('Sem resposta da chamada. Tente entrar novamente.')):r?.ok?resolve(r):reject(new Error(r?.error||'Falha na chamada'))));}
 private update(){if(!this.disposed)this.changed();}
 private publish(){if(this.ready&&!this.disposed)void this.emit('call-state',this.media).catch(e=>this.error(e.message));this.update();}
 private send(to:string,payload:any){if(!this.disposed)void this.emit('signal',{to,...payload}).catch(e=>{if(!this.disposed)this.error(e.message);});}
 private createPeer(id:string,name:string,user_id:string,media?:MediaState){
  const existing=this.peers.get(id);if(existing)return existing;
  const pc=new RTCPeerConnection(this.config);const p:RemotePeer={id,name,user_id,pc,camera:new MediaStream(),screen:new MediaStream(),audio:new MediaStream(),screenAudio:new MediaStream(),media:media||emptyMedia(),connection:'connecting',initiator:false,retries:0,audioReceived:0,audioSent:0,audioReceiving:false,audioSending:false,route:'Ainda negociando',pending:[],queue:Promise.resolve()};this.peers.set(id,p);
  pc.onicecandidate=e=>{if(e.candidate)this.send(id,{candidate:e.candidate.toJSON()});};
  pc.onconnectionstatechange=()=>{p.connection=pc.connectionState;this.update();if(pc.connectionState==='failed'&&p.initiator&&p.retries<2){void this.restartPeer(p);return;}if(pc.connectionState==='failed')this.error('A conexão com '+name+' falhou. Saia e entre novamente; redes restritivas podem precisar de TURN.');};
  pc.ontrack=e=>{const slot=pc.getTransceivers().indexOf(e.transceiver);const stream=[p.audio,p.camera,p.screen,p.screenAudio][slot];if(!stream)return;for(const old of stream.getTracks())stream.removeTrack(old);stream.addTrack(e.track);e.track.onunmute=()=>this.update();e.track.onmute=()=>this.update();this.update();};
  this.update();return p;
 }
 private async attach(p:RemotePeer){for(const [slot,t] of p.pc.getTransceivers().entries()){if(slot>3)break;t.direction='sendrecv';await t.sender.replaceTrack(this.tracks[slot]);}}
 private receive=(data:any)=>{
  if(this.disposed)return;const p=this.createPeer(data.from,data.name,data.user_id,data.media);if(data.media)p.media=data.media;
  p.queue=p.queue.then(async()=>{
   if(this.disposed||p.pc.signalingState==='closed')return;
   if(data.restart){if(p.initiator)await this.restartPeer(p);return;}
   if(data.description){await p.pc.setRemoteDescription(data.description);for(const candidate of p.pending)await p.pc.addIceCandidate(candidate);p.pending=[];
    if(data.description.type==='offer'){await this.attach(p);await p.pc.setLocalDescription(await p.pc.createAnswer());this.send(p.id,{description:p.pc.localDescription});}
   }else if(data.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(data.candidate);else p.pending.push(data.candidate);}
   this.update();
  }).catch(e=>{if(!this.disposed)this.error('Conexão de mídia: '+e.message);});
 };
 private peerState=(data:any)=>{const p=this.peers.get(data.peer);if(p){p.media=data.media;this.update();}};
 private peerLeft=(data:any)=>{if(data.room&&data.room!==this.room)return;this.peers.get(data.peer)?.pc.close();this.peers.delete(data.peer);this.update();};
 private lost=()=>{if(!this.disposed){this.error('Chamada encerrada. Entre novamente para reconectar.');this.ended();}};
 private callEnded=(data:any)=>{if((!data?.room||data.room===this.room)&&(!data?.token||data.token===this.token))this.lost();};
 async start(){
  try{
   const settings=await api('/rtc-config');this.config={iceServers:settings.iceServers,iceTransportPolicy:settings.iceTransportPolicy||'all'};this.turnConfigured=!!settings.turnConfigured;if(this.disposed)return;
   if(this.mode==='voice')try{await this.microphone('');}catch{this.note='Microfone indisponível ou sem permissão. Você entrou só para ouvir; a tela e a câmera continuam disponíveis.';}
   if(this.disposed)return;
   this.socket.on('signal',this.receive);this.socket.on('call-state',this.peerState);this.socket.on('call-left',this.peerLeft);this.socket.on('disconnect',this.lost);this.socket.on('call-ended',this.callEnded);
   this.joining=true;const result=await this.emit('call-join',{room:this.room,token:this.token});this.joining=false;if(this.disposed)return;
   this.joined=true;this.ready=true;this.publish();
   // Only the newcomer offers; existing sockets answer using the offered slots.
   for(const info of result.peers){if(this.disposed)return;const p=this.createPeer(info.id,info.name,info.user_id,info.media);p.initiator=true;for(const [slot,kind] of ['audio','video','video','audio'].entries())p.pc.addTransceiver(this.tracks[slot]||kind,{direction:'sendrecv'});await p.pc.setLocalDescription(await p.pc.createOffer());this.send(p.id,{description:p.pc.localDescription});}
   this.update();
  }catch(e:any){if(!this.disposed){this.error(e.message);this.ended();}}
 }
 private async restartPeer(p:RemotePeer){if(this.disposed||p.pc.signalingState!=='stable')return;p.retries++;try{await p.pc.setLocalDescription(await p.pc.createOffer({iceRestart:true}));this.send(p.id,{description:p.pc.localDescription});}catch(e:any){if(!this.disposed)this.error(e.message);}}
 async reconnect(){for(const p of this.peers.values()){if(p.initiator)await this.restartPeer(p);else this.send(p.id,{restart:true});}}
 async stats(){for(const p of this.peers.values()){if(p.pc.signalingState==='closed')continue;try{let rx=0,tx=0;const report=await p.pc.getStats();for(const stat of report.values()){if(stat.kind==='audio'&&stat.type==='inbound-rtp')rx+=stat.bytesReceived||0;if(stat.kind==='audio'&&stat.type==='outbound-rtp')tx+=stat.bytesSent||0;}p.audioReceiving=rx>p.audioReceived;p.audioSending=tx>p.audioSent;p.audioReceived=rx;p.audioSent=tx;const transport=[...report.values()].find((s:any)=>s.type==='transport'&&s.selectedCandidatePairId);const pair=transport?report.get(transport.selectedCandidatePairId):[...report.values()].find((s:any)=>s.type==='candidate-pair'&&s.nominated&&s.state==='succeeded');const local=pair&&report.get(pair.localCandidateId),remote=pair&&report.get(pair.remoteCandidateId);p.route=pair?(local?.candidateType==='relay'||remote?.candidateType==='relay'?'Via TURN':'Direta'):'Sem rota de mídia';}catch{}}this.update();}
 private async replace(slot:number,track:MediaStreamTrack|null){
  if(this.disposed){track?.stop();return;}
  const previous=this.tracks[slot];const replaced:RTCRtpSender[]=[];
  try{for(const p of this.peers.values()){const sender=p.pc.getTransceivers()[slot]?.sender;if(sender){await sender.replaceTrack(track);replaced.push(sender);}}}
  catch(e){for(const sender of replaced)await sender.replaceTrack(previous).catch(()=>{});track?.stop();throw e;}
  if(this.disposed){track?.stop();return;}
  this.tracks[slot]=track;if(previous!==track){if(previous)previous.onended=null;previous?.stop();}
 }
 async microphone(deviceId:string){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microfone indisponível neste navegador. Use HTTPS.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{...(deviceId?{deviceId:{exact:deviceId}}:{}),echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  if(this.disposed){stream.getTracks().forEach(t=>t.stop());return;}
  const t=stream.getAudioTracks()[0];if(!t)throw new Error('Microfone não encontrado');await this.replace(0,t);this.media.mic=true;this.media.deaf=false;this.note='';t.onended=()=>{this.media.mic=false;this.publish();};this.publish();
 }
 toggleMic(){const t=this.tracks[0];if(!t||t.readyState==='ended')return this.microphone('');this.media.mic=!this.media.mic;if(this.media.mic)this.media.deaf=false;t.enabled=this.media.mic;this.publish();return Promise.resolve();}
 toggleDeaf(){this.media.deaf=!this.media.deaf;if(this.media.deaf){this.media.mic=false;if(this.tracks[0])this.tracks[0].enabled=false;}this.publish();}
 async camera(deviceId:string){
  if(this.media.camera){await this.replace(1,null);this.media.camera=false;this.publish();return;}
  const stream=await navigator.mediaDevices.getUserMedia({video:deviceId?{deviceId:{exact:deviceId},width:{ideal:1280},height:{ideal:720}}:{width:{ideal:1280},height:{ideal:720}}});
  if(this.disposed){stream.getTracks().forEach(t=>t.stop());return;}
  const t=stream.getVideoTracks()[0];await this.replace(1,t);this.media.camera=true;t.onended=()=>{this.media.camera=false;this.publish();};this.publish();
 }
 async stopScreen(){await this.replace(2,null);await this.replace(3,null);this.media.screen=false;this.media.screenAudio=false;this.publish();}
 async share(quality:'720'|'1080',audio:boolean){
  if(this.media.screen){await this.stopScreen();return;}
  if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Compartilhar tela não está disponível neste navegador. Use o navegador do PC.');
  // Call directly from a click: the native chooser requires user activation.
  const stream=await navigator.mediaDevices.getDisplayMedia({video:{height:{ideal:Number(quality)},frameRate:{ideal:30,max:30}},audio});
  if(this.disposed){stream.getTracks().forEach(t=>t.stop());return;}
  try{await this.replace(2,stream.getVideoTracks()[0]);await this.replace(3,stream.getAudioTracks()[0]||null);this.media.screen=true;this.media.screenAudio=!!this.tracks[3];this.tracks[2]!.onended=()=>{void this.stopScreen().catch(e=>this.error(e.message));};this.publish();}
  catch(e){stream.getTracks().forEach(t=>t.stop());await this.stopScreen();throw e;}
 }
 dispose(){this.disposed=true;this.socket.off('signal',this.receive);this.socket.off('call-state',this.peerState);this.socket.off('call-left',this.peerLeft);this.socket.off('disconnect',this.lost);this.socket.off('call-ended',this.callEnded);if(this.joined||this.joining)this.socket.emit('call-leave',{room:this.room,token:this.token});for(const t of this.tracks){if(t)t.onended=null;t?.stop();}for(const p of this.peers.values())p.pc.close();this.peers.clear();}
}
