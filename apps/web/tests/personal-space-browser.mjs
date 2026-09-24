import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const temp=await mkdtemp(path.join(tmpdir(),'nexo-eight-')),origin='http://localhost:3105';
const server=spawn(process.execPath,['--import','tsx','apps/api/src/index.ts'],{cwd:process.cwd(),env:{...process.env,PORT:'3105',HOST:'127.0.0.1',APP_ORIGIN:origin,DATA_DIR:temp,DATABASE_URL:'',NODE_ENV:'development'},stdio:'pipe',windowsHide:true});
let output='',browser;server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
try{
 let ready=false;for(let i=0;i<360;i++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error(output);await new Promise(r=>setTimeout(r,500));}if(!ready)throw Error('Inicialização excedeu 3 minutos: '+output);
 browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const a=await browser.newContext({permissions:['microphone']}),b=await browser.newContext(),c=await browser.newContext();
 async function req(ctx,p,method='GET',data,status=200){const r=await ctx.request.fetch(origin+'/api'+p,{method,data,headers:{Origin:origin}});assert.equal(r.status(),status,await r.text());return r.json();}
 for(const [ctx,username] of [[a,'alice'],[b,'bobby'],[c,'carol']])await req(ctx,'/auth/register','POST',{username,password:'Browser-password-123'});
 const s=await req(a,'/servers','POST',{name:'Amigos'}),s2=await req(a,'/servers','POST',{name:'Jogos'});const inv=await req(a,'/servers/'+s.id+'/invites','POST');await req(b,'/invites/'+inv.code+'/join','POST');
 const state=await req(a,'/state'),room=state.rooms.find(r=>r.server_id===s.id&&r.kind==='text');
 const message=await req(a,'/rooms/'+room.id+'/messages','POST',{body:'Mensagem para analisar'});
 await req(b,'/messages/'+message.id+'/report','POST',{reason:'Solicito análise desta mensagem'});
 const reports=await req(a,'/servers/'+s.id+'/reports');assert.equal(reports.length,1);
 await req(b,'/reports/'+reports[0].id,'PATCH',{status:'resolved',decision:'Não sou moderador'},403);
 await req(a,'/reports/'+reports[0].id,'PATCH',{status:'resolved',decision:''},400);
 await req(a,'/reports/'+reports[0].id,'PATCH',{status:'resolved',decision:'Analisamos a mensagem e orientamos o membro.'});
 await req(a,'/reports/'+reports[0].id,'PATCH',{status:'dismissed',decision:'Segunda decisão'},409);
 assert.equal((await req(b,'/my-reports'))[0].decision,'Analisamos a mensagem e orientamos o membro.');assert.equal((await req(c,'/my-reports')).length,0);
 const upload=await a.request.post(origin+'/api/upload?room='+room.id,{headers:{Origin:origin},multipart:{file:{name:'regras.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nTeste de documento')}}});assert.equal(upload.status(),200,await upload.text());const attachment=await upload.json();
 await req(a,'/rooms/'+room.id+'/messages','POST',{body:'Documento da turma',attachment_id:attachment.id});
 assert.equal((await req(b,'/search?attachment=document&q=regras')).messages.length,1);assert.equal((await req(c,'/search?attachment=any')).messages.length,0);assert.equal((await req(b,'/search?attachment=image')).messages.length,0);
 assert.equal((await a.request.get(origin+'/version.json')).headers()['cache-control'],'no-store');const page=await a.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.getByTitle('Organizar comunidades').click();
 const editor=page.getByRole('dialog',{name:'Organizar comunidades'});await editor.getByLabel('Nome da pasta').fill('Minha turma');await editor.getByRole('button',{name:'Criar pasta'}).click();await editor.getByText('Minha turma',{exact:true}).first().waitFor();await editor.getByLabel('Pasta de Amigos').selectOption({label:'Minha turma'});await page.waitForTimeout(500);await editor.getByLabel('Subir Jogos').click();await page.waitForTimeout(500);
 let layout=await req(a,'/community-layout');assert.equal(layout.folders[0].servers[0],s.id);assert.equal(layout.order[0],s2.id);assert.deepEqual((await req(b,'/community-layout')).folders,[]);
 await req(c,'/community-layout','PUT',{folders:[{id:crypto.randomUUID(),name:'Tentativa',servers:[s.id]}],order:[s.id]});assert.deepEqual((await req(c,'/community-layout')).order,[]);
 await page.setViewportSize({width:390,height:844});await mkdir('docs/screenshots',{recursive:true});await page.screenshot({path:'docs/screenshots/personal-folders-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Escape');await editor.waitFor({state:'detached'});
 await page.reload();await page.setViewportSize({width:1280,height:900});await page.getByTitle('Pasta Minha turma').click();await page.getByTitle('Amigos',{exact:true}).click();await page.getByTitle('Buscar em todo o histórico').click();const search=page.getByRole('dialog',{name:'Buscar mensagens'});await search.locator('select[name=attachment]').selectOption('document');await search.getByRole('button',{name:'Buscar no histórico completo'}).click();await search.getByText('📎 regras.pdf').waitFor();await page.keyboard.press('Escape');
 // Reload closes the app's modal, regardless of its keyboard behavior.
 await page.reload();await page.getByTitle('Pasta Minha turma').click();await page.getByTitle('Amigos',{exact:true}).click();await page.getByTitle('Iniciar chamada').click();await page.getByRole('button',{name:'Gravar teste de voz'}).click();await page.getByRole('button',{name:'Parar teste de voz'}).waitFor();await page.waitForTimeout(1200);await page.getByRole('button',{name:'Parar teste de voz'}).click();const audio=page.getByLabel('Ouvir teste de voz');await audio.waitFor();await audio.evaluate(a=>a.play());await page.waitForTimeout(300);assert.ok(await audio.evaluate(a=>a.currentTime>0));await page.getByTitle('Cancelar chamada').click();
 await page.getByTitle('Novidades e versão').click();await page.getByRole('button',{name:'Verificar atualizações'}).click();await page.getByText('Você está na versão publicada mais recente.').waitFor();
 await page.route('**/version.json?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({id:'future-build',version:'0.8.1',builtAt:new Date().toISOString()})}));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('.update-banner').waitFor();assert.equal(await page.getByText('Você está na versão publicada mais recente.').count(),0);await page.screenshot({path:'docs/screenshots/personal-updates.png'});assert.deepEqual(errors,[]);
 console.log('PASS 0.8: folders and mobile layout, persistence and isolation, reports and moderation, attachment search, local voice playback, version/update detection');
}finally{await browser?.close();server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(temp,{recursive:true,force:true,maxRetries:5,retryDelay:200});}



