import test from 'node:test';import assert from 'node:assert/strict';
import {runSuctionDemo,suctionGuide,suctionGuideStages} from '../public/suction-demo.mjs';
function fixture(overrides={}){
 const calls=[],stages=[];let i=0;const states=[{phase:'confirm',claim:{id:'claim',kind:'all-angle-grip'}},{phase:'revision',graph:{kind:'suction'}},{phase:'design-review'},{phase:'transfer',problem:{id:'suction',formula:'suction-transfer-default'}},{phase:'complete',report:{outcome:'assisted'}}];
 return {calls,stages,options:{language:'en',testerAuthenticated:true,traceEnabled:true,signal:new AbortController().signal,
 request:async(path,body)=>{calls.push({path,body});if(path==='/api/session')return {sessionId:'s',phase:'claim',problem:{id:'suction'}};if(path==='/api/claim')return {sessionId:'s',phase:'prediction',problem:{id:'suction'}};return {sessionId:'s',problem:{id:'suction'},...states[i++]};},
 show:()=>{},step:()=>{},checkpoint:async stage=>{stages.push(stage);},play:async()=>true,...overrides}};
}
test('bilingual suction walkthrough has five real submissions and local teaching pauses',async()=>{
 for(const language of ['en','zh']){const f=fixture({language});assert.equal((await runSuctionDemo(f.options)).phase,'complete');assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,5);assert.deepEqual(f.stages,suctionGuideStages.slice(0,-1));assert.deepEqual(f.calls.at(-1).body.answer,{minPressurePa:2451.66,frictionAtPressureN:16});for(const stage of suctionGuideStages)assert.equal(suctionGuide(stage,language).length,5);}
});
test('a wrong proposed claim or clarification stops without fabricated confirmation or retries',async()=>{
 const f=fixture(),orig=f.options.request;f.options.request=async(p,b)=>{const r=await orig(p,b);if(r.phase==='confirm')r.claim.kind='stationary-pressure';return r;};await assert.rejects(runSuctionDemo(f.options),/Unexpected claim/);assert.equal(f.calls.length,2);
});
test('stop during a Next pause prevents any subsequent provider calls',async()=>{
 const controller=new AbortController(),f=fixture({signal:controller.signal,checkpoint:async stage=>{if(stage==='tilt')controller.abort();}});await assert.rejects(runSuctionDemo(f.options),e=>e.name==='AbortError');assert.equal(f.calls.filter(c=>c.path==='/api/turn').length,2);
});
test('trace gate prevents demo requests; failed playback prevents design calls',async()=>{
 const f=fixture({traceEnabled:false});await assert.rejects(runSuctionDemo(f.options));assert.equal(f.calls.length,0);
 const p=fixture({play:async()=>false});await assert.rejects(runSuctionDemo(p.options),/interrupted/);assert.equal(p.calls.filter(c=>c.path==='/api/turn').length,2);
});
