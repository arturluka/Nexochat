import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(path.join(tmpdir(),'nexo-browser-'));
const origin='http://localhost:3101';
const server=spawn(process.execPath,['--import','tsx','apps/api/src/index.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'3101',HOST:'127.0.0.1',APP_ORIGIN:origin,DATA_DIR:temp,DATABASE_URL:'',NODE_ENV:'development'},stdio:'pipe',windowsHide:true});
let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
let browser;
try{
 for(let attempt=0;attempt<120;attempt++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}if(server.exitCode!==null)throw new Error(output);await new Promise(r=>setTimeout(r,1000));}
 browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const a=await browser.newContext({viewport:{width:1440,height:960},permissions:['microphone','camera']});
 const b=await browser.newContext({viewport:{width:1440,height:960},permissions:['microphone','camera']});
 const errors=[];
 for(const ctx of [a,b])await ctx.addInitScript(()=>{window.__audioRequests=0;window.__captures=[];window.__noMic='';window.__cancelScreen=false;
const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
navigator.mediaDevices.getUserMedia=async c=>{if(c.audio){window.__audioRequests++;if(window.__noMic)throw new DOMException('Microfone simulado indisponível',window.__noMic);}const stream=await original(c);window.__captures.push(stream);return stream;};
navigator.mediaDevices.getDisplayMedia=async()=>{if(window.__cancelScreen)throw new DOMException('Cancelado','NotAllowedError');const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');let frame=0;const paint=()=>{ctx.fillStyle=frame++%2?'#684ac4':'#76d9b1';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='30px sans-serif';ctx.fillText('NexoChat • tela de teste '+frame,30,100);};paint();const timer=setInterval(paint,100);const stream=canvas.captureStream(10);window.__captures.push(stream);stream.getVideoTracks()[0].addEventListener('ended',()=>clearInterval(timer));return stream;};
window.__pcs=[];const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.__pcs.push(this);}};});
 const alice=await a.newPage(),bob=await b.newPage();for(const p of [alice,bob])p.on('pageerror',e=>errors.push(e.message));
 for(const [p,name] of [[alice,'alice'],[bob,'bobby']]){
  await p.goto(origin);await p.getByRole('button',{name:'Criar minha conta'}).click();await p.getByLabel('Nome de usuário',{exact:true}).fill(name);await p.getByLabel('Senha',{exact:true}).fill('Browser-test-password-123');await p.getByRole('button',{name:'Criar conta',exact:true}).click();await p.getByRole('button',{name:'Adicionar amigo',exact:true}).waitFor();
 }
 await alice.getByRole('button',{name:'Adicionar amigo',exact:true}).click();await alice.getByRole('dialog').getByLabel('Nome de usuário',{exact:true}).fill('bobby');await alice.getByRole('button',{name:'Enviar solicitação'}).click();
 await bob.getByRole('button',{name:/Solicitações/}).click();await bob.getByRole('button',{name:'Aceitar',exact:true}).click();await bob.getByRole('button',{name:'Todos',exact:true}).click();
 await alice.getByRole('button',{name:'Mensagem para bobby',exact:true}).click();await alice.getByRole('textbox',{name:'Mensagem',exact:true}).fill('Oi da interface!');await alice.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
 await bob.locator('.conversation').filter({hasText:'alice'}).click();await bob.getByText('Oi da interface!',{exact:true}).waitFor();await bob.getByRole('textbox',{name:'Mensagem',exact:true}).fill('Mensagem recebida em tempo real.');await bob.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await alice.getByText('Mensagem recebida em tempo real.',{exact:true}).waitFor();
 await alice.getByRole('button',{name:'Iniciar chamada'}).click();await mkdir('docs/screenshots',{recursive:true});await alice.screenshot({path:'docs/screenshots/call-lobby.png',fullPage:true});await alice.getByRole('button',{name:/^Conversar/}).click();await alice.getByText('Conectado · áudio em tempo real').waitFor();await bob.getByRole('button',{name:'Iniciar chamada'}).click();await bob.getByRole('button',{name:/^Conversar/}).click();await bob.getByText('Conectado · áudio em tempo real').waitFor();
 await alice.waitForFunction(()=>window.__pcs.some(p=>p.connectionState==='connected'),{},{timeout:30000});await bob.waitForFunction(()=>window.__pcs.some(p=>p.connectionState==='connected'),{},{timeout:30000});
 await alice.getByRole('button',{name:'Câmera',exact:true}).click();await bob.waitForFunction(()=>[...document.querySelectorAll('.video-tile video')].some(v=>v.videoWidth>0),{},{timeout:30000});
 const media=await bob.evaluate(async()=>{const result=[];for(const p of window.__pcs){for(const s of (await p.getStats()).values())if(s.type==='inbound-rtp')result.push({kind:s.kind,bytesReceived:s.bytesReceived,framesDecoded:s.framesDecoded});}return result;});assert.ok(media.some(s=>s.kind==='audio'&&s.bytesReceived>0));assert.ok(media.some(s=>s.kind==='video'&&s.framesDecoded>0));

 // Camera and screen travel on different slots. Stopping either must preserve the other.
 await alice.getByTitle('Compartilhar tela',{exact:true}).click();
 await bob.waitForFunction(()=>[...document.querySelectorAll('.video-tile video')].filter(v=>v.videoWidth>0).length===2);
 await alice.getByTitle('Compartilhar tela',{exact:true}).click();await bob.locator('.screen-tile').waitFor({state:'detached'});assert.equal(await bob.locator('.video-tile').count(),1);
 await alice.getByTitle('Compartilhar tela',{exact:true}).click();await bob.locator('.screen-tile').waitFor();
 await alice.getByRole('button',{name:'Câmera',exact:true}).click();await bob.waitForFunction(()=>document.querySelectorAll('.video-tile').length===1&&!!document.querySelector('.screen-tile'));
 await alice.getByTitle('Compartilhar tela',{exact:true}).click();
 await alice.getByRole('button',{name:'Microfone',exact:true}).click();await alice.getByRole('button',{name:'Ensurdecer',exact:true}).click();await alice.getByRole('button',{name:'Dispositivos',exact:true}).click();await alice.getByRole('button',{name:'Sair da chamada'}).click();await bob.getByRole('button',{name:'Sair da chamada'}).click();

 console.log('PASS: câmera e tela simultâneas, parar/reiniciar e áudio/vídeo recebidos.');
 // No microphone: automatic fallback still receives real audio and sends camera/screen.
 await alice.evaluate(()=>{window.__noMic='NotFoundError';window.__pcs=[];});await bob.evaluate(()=>{window.__pcs=[];});
 await alice.getByRole('button',{name:'Iniciar chamada'}).click();await alice.getByRole('button',{name:/^Conversar/}).click();await alice.getByText(/Microfone indisponível ou sem permissão/).waitFor();
 await bob.getByRole('button',{name:'Iniciar chamada'}).click();await bob.getByRole('button',{name:/^Conversar/}).click();await alice.waitForFunction(()=>window.__pcs.some(p=>p.connectionState==='connected'));
 await alice.waitForFunction(async()=>{for(const p of window.__pcs)for(const s of (await p.getStats()).values())if(s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0)return true;return false;});
 assert.equal(await alice.evaluate(()=>window.__pcs[0].getTransceivers()[0].sender.track),null);
 await alice.evaluate(()=>window.__cancelScreen=true);await alice.getByTitle('Compartilhar tela',{exact:true}).click();await alice.getByText(/Permissão cancelada/).waitFor();await alice.getByRole('button',{name:'Fechar aviso',exact:true}).click();assert.equal(await alice.locator('.call-v2').count(),1);
 await alice.evaluate(()=>window.__cancelScreen=false);await alice.getByTitle('Compartilhar tela',{exact:true}).click();await bob.locator('.screen-tile').waitFor();
 await alice.getByRole('button',{name:'Câmera',exact:true}).click();await bob.waitForFunction(()=>[...document.querySelectorAll('.video-tile video')].filter(v=>v.videoWidth>0).length===2);
 await alice.evaluate(()=>window.__noMic='');await alice.getByRole('button',{name:'Microfone',exact:true}).click();await bob.waitForFunction(async()=>{for(const p of window.__pcs)for(const s of (await p.getStats()).values())if(s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0)return true;return false;});
 await alice.getByRole('button',{name:'Sair da chamada'}).click();await bob.getByRole('button',{name:'Sair da chamada'}).click();
 assert.equal(await alice.evaluate(()=>window.__captures.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true);
 // Permission denial also falls back without ending the call.
 await alice.evaluate(()=>window.__noMic='NotAllowedError');await alice.getByRole('button',{name:'Iniciar chamada'}).click();await alice.getByRole('button',{name:/^Conversar/}).click();await alice.getByText(/Microfone indisponível ou sem permissão/).waitFor();await alice.getByRole('button',{name:'Sair da chamada'}).click();await alice.evaluate(()=>window.__noMic='');
 console.log('PASS: ausência e permissão negada de microfone, ativação tardia e limpeza.');
 // Same account on PC + phone; listener mode must never request a microphone.
 const phoneContext=await browser.newContext({storageState:await a.storageState(),viewport:{width:390,height:844},permissions:['microphone','camera']});const phone=await phoneContext.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(origin);await phone.getByRole('button',{name:'Abrir menu'}).click();await phone.locator('.conversation').filter({hasText:'bobby'}).click();
 const beforePC=await alice.evaluate(()=>window.__audioRequests),beforeBob=await bob.evaluate(()=>window.__audioRequests);
 await alice.getByRole('button',{name:'Iniciar chamada'}).click();await alice.getByRole('button',{name:/Usar PC com celular/}).click();await alice.getByText('Conectado · áudio em tempo real').waitFor();
 await phone.getByRole('button',{name:'Iniciar chamada'}).click();await phone.getByRole('button',{name:/^Conversar/}).click();await phone.getByText('Conectado · áudio em tempo real').waitFor({state:'attached'});
 await bob.getByRole('button',{name:'Iniciar chamada'}).click();await bob.getByRole('button',{name:/^Só ouvir/}).click();await bob.getByText('Conectado · áudio em tempo real').waitFor();
 await alice.locator('.same-account').waitFor();await phone.locator('.same-account').waitFor();assert.equal(await alice.evaluate(()=>[...document.querySelectorAll('.call-person audio')].every(a=>a.muted)),true);assert.equal(await phone.locator('.same-account').evaluate(el=>[...el.querySelectorAll('audio')].every(a=>a.muted)),true);
 assert.equal(await alice.evaluate(()=>window.__audioRequests),beforePC);assert.equal(await bob.evaluate(()=>window.__audioRequests),beforeBob);
 await alice.getByTitle('Compartilhar tela',{exact:true}).click();await bob.locator('.screen-tile').waitFor();await phone.locator('.screen-tile').waitFor();await phone.waitForFunction(()=>document.querySelector('.screen-tile video')?.videoWidth>0);
 await alice.getByRole('button',{name:'Sair da chamada'}).click();await phone.locator('.screen-tile').waitFor({state:'detached'});assert.equal(await phone.locator('.call-v2').count(),1);assert.equal(await bob.locator('.call-v2').count(),1);
 await phone.getByRole('button',{name:'Sair da chamada'}).click();await bob.getByRole('button',{name:'Sair da chamada'}).click();await phoneContext.close();
 console.log('PASS: PC + celular na mesma conta, listener sem pedir microfone, tela recebida e saída independente.');
 // Profile edits persist, including image IDs and privacy, and render on mobile.
 await alice.getByRole('button',{name:'Configurações',exact:true}).click();await alice.getByLabel('Nome de exibição',{exact:true}).fill('Alice Nexo');await alice.getByLabel(/Pronomes/).fill('ela/dela');await alice.getByLabel('Status personalizado',{exact:true}).fill('🎮 Juntos na próxima partida');await alice.getByLabel('Sobre mim',{exact:true}).fill('Conversas, jogos e boas conexões. Meu espaço, minha turma.');await alice.getByRole('button',{name:'Cor #76d9b1',exact:true}).click();
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4Z8AAAAASUVORK5CYII=','base64');await alice.getByLabel('Arquivo do avatar',{exact:true}).setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});await alice.getByLabel('Arquivo do banner',{exact:true}).setInputFiles({name:'banner.png',mimeType:'image/png',buffer:png});await alice.getByRole('button',{name:'Salvar alterações',exact:true}).click();await alice.getByText('Perfil atualizado!',{exact:true}).waitFor();
 const updated=await (await a.request.get(origin+'/api/state')).json();assert.equal(updated.me.pronouns,'ela/dela');assert.equal(updated.me.accent_color,'#76d9b1');assert.ok(updated.me.avatar_id);assert.ok(updated.me.banner_id);
 await alice.getByRole('button',{name:'Remover banner',exact:true}).click();await alice.getByRole('button',{name:'Salvar alterações',exact:true}).click();await alice.getByText('Perfil atualizado!',{exact:true}).waitFor();
 await alice.getByRole('button',{name:'Remover',exact:true}).click();await alice.getByRole('button',{name:'Salvar alterações',exact:true}).click();await alice.getByText('Perfil atualizado!',{exact:true}).waitFor();assert.equal((await (await a.request.get(origin+'/api/state')).json()).me.avatar_id,null);
 await mkdir('docs/screenshots',{recursive:true});await alice.locator('.settings-panel').evaluate(el=>el.scrollTop=0);await alice.screenshot({path:'docs/screenshots/profile-desktop.png',fullPage:true});await alice.setViewportSize({width:390,height:844});await alice.locator('.profile-settings').evaluate(el=>el.scrollTop=0);await alice.screenshot({path:'docs/screenshots/profile-mobile.png',fullPage:true});assert.equal(await alice.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await alice.getByRole('button',{name:'Fechar',exact:true}).click();await alice.setViewportSize({width:1440,height:960});await alice.reload();await alice.getByText('Alice Nexo',{exact:true}).waitFor();
 await alice.getByRole('button',{name:'Início',exact:true}).click();await mkdir('docs/screenshots',{recursive:true});await alice.screenshot({path:'docs/screenshots/desktop.png',fullPage:true});
 await alice.setViewportSize({width:390,height:844});await alice.screenshot({path:'docs/screenshots/mobile.png',fullPage:true});assert.equal(await alice.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await alice.getByRole('button',{name:'Abrir menu'}).click();await alice.getByRole('button',{name:'Configurações',exact:true}).click();await alice.getByRole('dialog').waitFor();await alice.getByRole('button',{name:'Fechar',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('Browser PASS: perfil persistido, avatar/banner, prévia responsiva, DM, WebRTC real, câmera+tela, cancelamento, listener, ausência de microfone, ativação tardia, PC+celular mesma conta e limpeza de mídia.');console.log(JSON.stringify(media));
}finally{if(browser)await browser.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('exit',r));}await rm(temp,{recursive:true,force:true});}

