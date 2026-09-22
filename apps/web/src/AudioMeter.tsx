import {useEffect,useState} from 'react';
export default function AudioMeter({track,enabled}:{track:MediaStreamTrack|null|undefined,enabled:boolean}){
 const [level,setLevel]=useState(0),[suspended,setSuspended]=useState(false);
 useEffect(()=>{if(!track||!enabled){setLevel(0);return;}let cancelled=false;let timer:ReturnType<typeof setInterval>;const ctx=new AudioContext();const source=ctx.createMediaStreamSource(new MediaStream([track]));const analyser=ctx.createAnalyser();analyser.fftSize=256;const silent=ctx.createGain();silent.gain.value=0;source.connect(analyser);analyser.connect(silent);silent.connect(ctx.destination);const data=new Uint8Array(analyser.fftSize);
  const resume=()=>{void ctx.resume().then(()=>{if(!cancelled)setSuspended(ctx.state!=='running');}).catch(()=>{});};resume();window.addEventListener('pointerdown',resume);timer=setInterval(()=>{if(cancelled)return;setSuspended(ctx.state!=='running');analyser.getByteTimeDomainData(data);let energy=0;for(const value of data)energy+=((value-128)/128)**2;setLevel(Math.min(100,Math.round(Math.sqrt(energy/data.length)*350)));},120);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('pointerdown',resume);source.disconnect();analyser.disconnect();silent.disconnect();void ctx.close();};
 },[track,enabled]);
 return <div className="mic-meter"><span>{!enabled?'Microfone desligado':suspended?'Toque na tela para ativar o medidor':level>3?'Seu microfone está captando som':'Fale para testar o microfone'}</span><meter min="0" max="100" value={enabled?level:0} aria-label="Nível do microfone"/></div>;
}
