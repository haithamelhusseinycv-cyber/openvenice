import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleVeniceSession } from './venice-session-proxy.mjs';
test('rejects cross-origin calls before contacting backend', async () => {
 let called=false;
 const res=await handleVeniceSession(new Request('https://chilli.example/api/venice/image/generate',{method:'POST',headers:{Origin:'https://attacker.example'}}),async()=>{called=true;});
 assert.equal(res.status,403);assert.equal(called,false);
});
test('does not expose owner challenge route',async()=>{
 const res=await handleVeniceSession(new Request('https://chilli.example/venice-auth/challenge'));
 assert.equal(res.status,404);
});
test('forwards session cookie, discards client bearer, streams response',async()=>{
 let observed;
 const res=await handleVeniceSession(new Request('https://chilli.example/api/venice/models?type=image',{headers:{Cookie:'venice_session=owner',Authorization:'Bearer client-key',Origin:'https://chilli.example'}}),async(url,options)=>{
 observed={url,options};return new Response('catalog',{headers:{'Content-Type':'application/json'}});
 });
 assert.equal(observed.url,'https://venice.grokbot.download/api/venice/models?type=image');
 assert.equal(observed.options.headers.get('cookie'),'venice_session=owner');
 assert.equal(observed.options.headers.get('authorization'),null);
 assert.equal(observed.options.headers.get('origin'),'https://venice.grokbot.download');
 assert.equal(await res.text(),'catalog');
 assert.equal(res.headers.get('Cache-Control'),'no-store');
});
test('connection consumes code once upstream and sets a host-only cookie',async()=>{
 const res=await handleVeniceSession(new Request('https://chilli.example/venice-auth/consume?code=test'),async()=>new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':'venice_session=example; Path=/; HttpOnly; Secure; SameSite=Strict'}}));
 assert.equal(res.status,302);assert.equal(res.headers.get('Location'),'/');
 assert.match(res.headers.get('Set-Cookie'),/HttpOnly/);
 assert.doesNotMatch(res.headers.get('Set-Cookie'),/Domain=/);
});
