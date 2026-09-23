import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rtcSettings} from '../src/rtc-config.js';
test('configuração RTC valida TURN, política e não expõe credenciais em erros',()=>{
 assert.equal(rtcSettings({}).turnConfigured,false);
 const value=rtcSettings({ICE_SERVERS:JSON.stringify([{urls:['turn:relay.example:3478','turns:relay.example:443?transport=tcp'],username:'user',credential:'secret-test'}]),ICE_TRANSPORT_POLICY:'relay'});assert.equal(value.turnConfigured,true);assert.equal(value.iceTransportPolicy,'relay');
 for(const env of [{ICE_SERVERS:'invalid-secret-test'},{ICE_SERVERS:'[{"urls":"https://wrong"}]'},{ICE_SERVERS:'[{"urls":"turn:relay.example:3478"}]'},{ICE_TRANSPORT_POLICY:'relay'}])assert.throws(()=>rtcSettings(env),e=>(e as any).status===503&&!(e as Error).message.includes('secret-test'));
});
