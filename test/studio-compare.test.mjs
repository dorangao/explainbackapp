import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';
import {scoreOpenReply} from '../src/eval/studio.mjs';

const bi=text=>({en:text,zh:'示例'+text});
const ready=lesson=>({structured:{name:'compose_lesson',value:{status:'ready',message:bi('Ready'),lesson}}});
const judged=(scores,issues=[])=>({structured:{name:'judge_lesson',value:{scores,issues,summary:'Checked.'}}});
const full={neutralFraming:2,quantityNames:2,transferClarity:2,bilingualParity:2,assumptions:2};

async function setup(t,modelCall,{models=['muse-wonder-1.0','muse-spark-1.3'],quota}={}){
 const targets=models.map(model=>({id:'meta:'+model,provider:'meta',model,label:model,configured:true,timeoutMs:30000}));
 const router={defaultId:targets[0].id,list:()=>targets,call:async()=>assert.fail('injected model call expected')};
 const server=createApp({testerCredentials,router,modelCall,...(quota?{testerQuota:quota}:{})});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en',llm:targets[0].id})).json();
 return {post,sessionId:s.sessionId};
}

test('scoreOpenReply checks the contract, the renderer kind, the chapter count and a unit-labelled output',()=>{
 const ok=scoreOpenReply(ready(coolingLesson()));assert.equal(ok.contractValid,true);assert.equal(ok.status,'ready');assert.equal(ok.kind,'model');assert.equal(ok.automatedPass,true);
 const process=scoreOpenReply(ready(processLesson()));assert.equal(process.automatedPass,true);assert.equal(process.kind,'process');assert.equal(process.checks.outputUnit,undefined);
 const unitless=coolingLesson();unitless.chapters[0].demo.outputs[0].unit='1';
 const noUnit=scoreOpenReply(ready(unitless));assert.equal(noUnit.contractValid,true);assert.equal(noUnit.automatedPass,false);assert.equal(noUnit.failure,'expectation-failed');
 const declined=scoreOpenReply({structured:{name:'compose_lesson',value:{status:'unsupported',message:bi('No'),lesson:null}}});assert.equal(declined.status,'unsupported');assert.equal(declined.automatedPass,true);
 const broken=coolingLesson();broken.chapters[0].demo.claim.zh='温度会怎样变化？';
 const rejected=scoreOpenReply(ready(broken));assert.equal(rejected.contractValid,false);assert.equal(rejected.failure,'contract-rejected');assert.match(rejected.reason,/statement, not a question/);
});

test('compare drafts the question with both models, judges the ready lessons and charges four requests',async t=>{
 const calls=[];
 const {post,sessionId}=await setup(t,async(args,id)=>{
  const name=args.tools[0].name;calls.push(`${id}:${name}`);
  if(name==='compose_lesson')return {...ready(id.includes('wonder')?coolingLesson():processLesson()),model:id.slice(5),usage:{input_tokens:100,output_tokens:200}};
  if(name==='judge_lesson'){const input=JSON.parse(args.input);assert.equal(input.topic,'Why does coffee cool?');return judged(input.category==='model'?full:{...full,bilingualParity:1},input.category==='model'?[]:['A stage title mixes languages.']);}
  assert.fail('unexpected tool '+name);
 });
 const response=await post('/api/studio/compare',{sessionId,topic:'  Why does coffee cool?  '});
 assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.question,'Why does coffee cool?');assert.equal(result.attemptsRemaining,4);assert.equal(result.judge,'muse-spark-1.3');assert.match(result.judgeVersion,/studio-judge/);
 assert.equal(result.replies.length,2);
 const [wonder,spark]=result.replies;
 assert.equal(wonder.model,'muse-wonder-1.0');assert.equal(wonder.status,'ready');assert.equal(wonder.kind,'model');assert.equal(wonder.automatedPass,true);assert.deepEqual(wonder.usage,{input:100,output:200});
 assert.equal(wonder.judge.total,10);assert.deepEqual(wonder.judge.issues,[]);assert.equal(wonder.judge.model,'muse-spark-1.3');
 assert.equal(spark.model,'muse-spark-1.3');assert.equal(spark.kind,'process');assert.equal(spark.judge.total,9);assert.deepEqual(spark.judge.issues,['A stage title mixes languages.']);
 assert.equal(wonder.response,undefined);assert.ok(wonder.lesson.chapters.length>=1);
 // Two drafts (one per model) and two judge calls, both judged by the tester role.
 assert.deepEqual(calls.sort(),['meta:muse-spark-1.3:compose_lesson','meta:muse-spark-1.3:judge_lesson','meta:muse-spark-1.3:judge_lesson','meta:muse-wonder-1.0:compose_lesson']);
 // Without the judge only the two drafts are charged.
 calls.length=0;
 const plain=await(await post('/api/studio/compare',{sessionId,topic:'Why does coffee cool?',judge:false})).json();
 assert.equal(plain.attemptsRemaining,2);assert.equal(plain.replies[0].judge,null);assert.equal(plain.judge,null);assert.equal(calls.length,2);
 // The session cap of eight attempts refuses a third comparison before any call.
 calls.length=0;
 const refused=await post('/api/studio/compare',{sessionId,topic:'Once more',judge:false});assert.equal(refused.status,200);
 const over=await post('/api/studio/compare',{sessionId,topic:'And again'});assert.equal(over.status,429);assert.equal(calls.length,2);
});

test('compare reports a rejected contract, a declined request and a failed model without failing the whole comparison',async t=>{
 let sparkMode='declined';
 const {post,sessionId}=await setup(t,async(args,id)=>{
  const name=args.tools[0].name;
  if(name==='judge_lesson')return judged(full);
  if(id.includes('wonder')){const broken=coolingLesson();broken.chapters[0].demo.outputs[0].expression='1/(x-12.345)';return ready(broken);}
  if(sparkMode==='declined')return {structured:{name,value:{status:'unsupported',message:bi('Not a bounded model.'),lesson:null}}};
  throw new Error('provider down');
 });
 const first=await(await post('/api/studio/compare',{sessionId,topic:'Predict the stock market'})).json();
 const [wonder,spark]=first.replies;
 assert.equal(wonder.status,'rejected');assert.equal(wonder.lesson,null);assert.match(wonder.reason,/finite|singular|division|range|value/i);assert.equal(wonder.judge,null);
 assert.equal(spark.status,'unsupported');assert.equal(spark.message.en,'Not a bounded model.');assert.equal(spark.automatedPass,true);assert.equal(spark.judge,null);
 assert.equal(first.attemptsRemaining,6);
 sparkMode='down';
 const second=await(await post('/api/studio/compare',{sessionId,topic:'Predict the stock market'})).json();
 assert.equal(second.replies[1].status,'failed');assert.equal(second.replies[1].lesson,null);assert.equal(second.attemptsRemaining,4);
});

test('compare lets the creator pick Wonder as the judge and refuses a judge outside the pair',async t=>{
 const calls=[];
 const {post,sessionId}=await setup(t,async(args,id)=>{
  const name=args.tools[0].name;calls.push(`${id}:${name}`);
  if(name==='compose_lesson')return ready(id.includes('wonder')?coolingLesson():processLesson());
  return judged(full);
 });
 const result=await(await post('/api/studio/compare',{sessionId,topic:'Why does coffee cool?',judge:'meta:muse-wonder-1.0'})).json();
 assert.equal(result.judge,'muse-wonder-1.0');assert.equal(result.attemptsRemaining,4);
 for(const reply of result.replies)assert.equal(reply.judge.model,'muse-wonder-1.0');
 assert.deepEqual(calls.filter(c=>c.endsWith('judge_lesson')),['meta:muse-wonder-1.0:judge_lesson','meta:muse-wonder-1.0:judge_lesson']);
 calls.length=0;
 const outside=await post('/api/studio/compare',{sessionId,topic:'Why does coffee cool?',judge:'meta:muse-glimmer'});
 assert.equal(outside.status,400);assert.equal(calls.length,0);
});

test('compare needs two different configured models and a valid topic',async t=>{
 const {post,sessionId}=await setup(t,async()=>assert.fail('no call expected'),{models:['muse-spark-1.3']});
 assert.equal((await post('/api/studio/compare',{sessionId,topic:'Cooling'})).status,503);
 const two=await setup(t,async()=>assert.fail('no call expected'));
 assert.equal((await two.post('/api/studio/compare',{sessionId:two.sessionId,topic:''})).status,400);
 assert.equal((await two.post('/api/studio/compare',{sessionId:two.sessionId,topic:'x'.repeat(601)})).status,400);
 assert.equal((await two.post('/api/studio/compare',{sessionId:two.sessionId,topic:'Cooling',judge:'yes'})).status,400);
});
