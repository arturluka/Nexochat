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
 for(const ctx of [a,b])await ctx.addInitScript(()=>{window.__pcs=[];const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.__pcs.push(this);}};});
 const alice=await a.newPage(),bob=await b.newPage();for(const p of [alice,bob])p.on('pageerror',e=>errors.push(e.message));
 for(const [p,name] of [[alice,'alice'],[bob,'bobby']]){
  await p.goto(origin);await p.getByRole('button',{name:'Criar minha conta'}).click();await p.getByLabel('Nome de usuário',{exact:true}).fill(name);await p.getByLabel('Senha',{exact:true}).fill('Browser-test-password-123');await p.getByRole('button',{name:'Criar conta',exact:true}).click();await p.getByRole('button',{name:'Adicionar amigo',exact:true}).waitFor();
 }
 await alice.getByRole('button',{name:'Adicionar amigo',exact:true}).click();await alice.getByRole('dialog').getByLabel('Nome de usuário',{exact:true}).fill('bobby');await alice.getByRole('button',{name:'Enviar solicitação'}).click();
 await bob.getByRole('button',{name:/Solicitações/}).click();await bob.getByRole('button',{name:'Aceitar',exact:true}).click();await bob.getByRole('button',{name:'Todos',exact:true}).click();
 await alice.getByRole('button',{name:'Mensagem para bobby',exact:true}).click();await alice.getByRole('textbox',{name:'Mensagem',exact:true}).fill('Oi da interface!');await alice.getByRole('button',{name:'Enviar mensagem',exact:true}).click();
 await bob.locator('.conversation').filter({hasText:'alice'}).click();await bob.getByText('Oi da interface!',{exact:true}).waitFor();await bob.getByRole('textbox',{name:'Mensagem',exact:true}).fill('Mensagem recebida em tempo real.');await bob.getByRole('button',{name:'Enviar mensagem',exact:true}).click();await alice.getByText('Mensagem recebida em tempo real.',{exact:true}).waitFor();
 await alice.getByRole('button',{name:'Iniciar chamada'}).click();await alice.getByText('Conectado · áudio em tempo real').waitFor();await bob.getByRole('button',{name:'Iniciar chamada'}).click();await bob.getByText('Conectado · áudio em tempo real').waitFor();
 await alice.waitForFunction(()=>window.__pcs.some(p=>p.connectionState==='connected'),{},{timeout:30000});await bob.waitForFunction(()=>window.__pcs.some(p=>p.connectionState==='connected'),{},{timeout:30000});
 await alice.getByRole('button',{name:'Câmera',exact:true}).click();await bob.waitForFunction(()=>[...document.querySelectorAll('.video-tile video')].some(v=>!v.muted&&v.videoWidth>0),{},{timeout:30000});
 const media=await bob.evaluate(async()=>{const result=[];for(const p of window.__pcs){for(const s of (await p.getStats()).values())if(s.type==='inbound-rtp')result.push({kind:s.kind,bytesReceived:s.bytesReceived,framesDecoded:s.framesDecoded});}return result;});assert.ok(media.some(s=>s.kind==='audio'&&s.bytesReceived>0));assert.ok(media.some(s=>s.kind==='video'&&s.framesDecoded>0));
 await alice.getByRole('button',{name:'Microfone',exact:true}).click();await alice.getByRole('button',{name:'Ensurdecer',exact:true}).click();await alice.getByRole('button',{name:'Dispositivos',exact:true}).click();await alice.getByRole('button',{name:'Sair da chamada'}).click();await bob.getByRole('button',{name:'Sair da chamada'}).click();
 await alice.getByRole('button',{name:'Início',exact:true}).click();await mkdir('docs/screenshots',{recursive:true});await alice.screenshot({path:'docs/screenshots/desktop.png',fullPage:true});
 await alice.setViewportSize({width:390,height:844});await alice.screenshot({path:'docs/screenshots/mobile.png',fullPage:true});assert.equal(await alice.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await alice.getByRole('button',{name:'Abrir menu'}).click();await alice.getByRole('button',{name:'Configurações',exact:true}).click();await alice.getByRole('dialog').waitFor();await alice.getByRole('button',{name:'Fechar',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('Browser PASS: cadastro, amizade, DM bidirecional, WebRTC conectado, áudio recebido, vídeo decodificado, controles, desktop e mobile.');console.log(JSON.stringify(media));
}finally{if(browser)await browser.close();server.kill();await new Promise(r=>server.once('exit',r));await rm(temp,{recursive:true,force:true});}
