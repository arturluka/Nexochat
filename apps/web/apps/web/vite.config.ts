import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {randomUUID} from 'node:crypto';
const build={version:'0.8.0',id:randomUUID(),builtAt:new Date().toISOString()};
export default defineConfig({define:{__NEXO_BUILD__:JSON.stringify(build)},plugins:[react(),{name:'nexo-version',generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify(build)});}}],server:{proxy:{'/api':'http://127.0.0.1:3001','/socket.io':{target:'http://127.0.0.1:3001',ws:true}}}});
