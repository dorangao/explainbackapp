import {test} from 'node:test';import assert from 'node:assert/strict';
import {runPresetDemo} from '../public/demo-runner.mjs';
function fixture(overrides={}){
 const calls=[],steps=[];let played=0,index=0;
 const states=[{phase:'confirm',claim:{id:'c1',kind:'rotation-torque'}},{phase:'revision',graph:{kind:'flight'}},{phase:'transfer',problem:{id:'flight',formula:'flight-transfer-default'},claim:{kind:'rotation-torque'},answerFields:[{key:'peakTorque'},{key:'touchdownOmegaA'}]},{phase:'complete',report:{outcome:'assisted'}}];
 return {calls,steps,get played(){return played;},options:{language:'en',testerAuthenticated:true,traceEnabled:true,signal:new AbortController().signal,
  request:async(path,body)=>{calls.push({path,body});if(path==='/api/session')return {sessionId:'s1',phase:'claim',problem:{id:'flight'}};if(path==='/api/claim')return {sessionId:'s1',phase:'prediction',problem:{id:'flight'},claim:{kind:'rotation-torque'}};return {sessionId:'s1',problem:{id:'flight'},claim:{kind:'rotation-torque'},...states[index++]};},
  show:()=>{},step:s=>steps.push(s),checkpoint:async()=>{},play:async()=>{played++;return true;},...overrides}};
}
test('one-click workflow makes exactly four provider submissions and plays before transfer',async()=>{
 const f=fixture();const s=await runPresetDemo(f.options);
 assert.equal(s.phase,'complete');assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,4);assert.equal(f.played,3);
 assert.deepEqual(f.steps,['start','claim','confirm','prediction','evidence','acceleration','flip','landing','revision','transfer','complete']);
 const confirmation=f.calls.find(c=>c.path==='/api/claim');assert.equal(confirmation.body.source,'scripted-demo');
 for(const c of f.calls.filter(c=>c.path==='/api/turn'))assert.equal(c.body.demoPreset,true);
 assert.deepEqual(f.calls.at(-1).body.answer,{peakTorque:26318.95,touchdownOmegaA:5.24});
});
test('demo does not assert tester authentication or enable tracing by itself',async()=>{
 for(const flags of [{testerAuthenticated:false},{traceEnabled:false}]){const f=fixture(flags);await assert.rejects(runPresetDemo(f.options));assert.equal(f.calls.length,0);}
});
test('provider clarification stops the script without retry or fabricated confirmation',async()=>{
 const f=fixture();const original=f.options.request;f.options.request=async(path,body)=>path==='/api/turn'?(f.calls.push({path,body}),{sessionId:'s1',phase:'claim'}):original(path,body);
 await assert.rejects(runPresetDemo(f.options),/unexpected/i);assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,1);assert.equal(f.played,0);
});
test('cancel during a provider call prevents confirmation and subsequent calls',async()=>{
 const controller=new AbortController(),rendered=[],f=fixture({signal:controller.signal,show:s=>rendered.push(s.phase)});const original=f.options.request;
 f.options.request=async(path,body)=>{const s=await original(path,body);if(path==='/api/turn')controller.abort();return s;};
 await assert.rejects(runPresetDemo(f.options),e=>e.name==='AbortError');assert.equal(f.calls.length,2);
 assert.equal(rendered.at(-1),'confirm','Stop must reconcile a response that already advanced the server');
});
test('failed requests are not retried and interrupted playback cannot advance transfer',async()=>{
 const f=fixture();f.options.request=async()=>{throw new Error('provider unavailable');};await assert.rejects(runPresetDemo(f.options),/unavailable/);
 const p=fixture({play:async()=>false});await assert.rejects(runPresetDemo(p.options),/playback/i);assert.equal(p.calls.filter(c=>c.path==='/api/turn').length,2);
});
test('Chinese walkthrough uses localized presets and cancellation during a pause prevents calls',async()=>{
 const zh=fixture({language:'zh'});await runPresetDemo(zh.options);assert.match(zh.calls.find(c=>c.path==='/api/turn').body.explanation,/力矩/);
 const controller=new AbortController(),f=fixture({signal:controller.signal,checkpoint:async()=>controller.abort()});await assert.rejects(runPresetDemo(f.options),e=>e.name==='AbortError');assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,0);
});

test('Next checkpoints prevent calls and animation advancing while the reader pauses',async()=>{
 let release;const gates=[],segments=[],f=fixture({checkpoint:stage=>new Promise(r=>{gates.push(stage);release=r;}),play:async(_signal,phase)=>{segments.push(phase);return true;}});
 const task=runPresetDemo(f.options);const flush=()=>new Promise(r=>setImmediate(r));await flush();
 const expected=[['claim',0,0],['confirm',1,0],['prediction',1,0],['evidence',2,0],['acceleration',2,1],['flip',2,2],['landing',2,3],['revision',2,3],['transfer',3,3]];
 for(const[stage,calls,plays]of expected){
  assert.equal(gates.at(-1),stage);assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,calls);assert.equal(segments.length,plays);
  await flush();assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,calls,'waiting must not spend a request');release();await flush();
 }
 assert.equal((await task).phase,'complete');assert.deepEqual(segments,['acceleration','flip','landing']);
});
test('Stop after an animation checkpoint never starts the next segment or request',async()=>{
 const controller=new AbortController(),segments=[],f=fixture({signal:controller.signal,checkpoint:async stage=>{if(stage==='acceleration')controller.abort();},play:async(_signal,phase)=>{segments.push(phase);return true;}});
 await assert.rejects(runPresetDemo(f.options),e=>e.name==='AbortError');assert.deepEqual(segments,['acceleration']);assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,2);
});
