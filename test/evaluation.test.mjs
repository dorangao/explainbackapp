import {test} from 'node:test';import assert from 'node:assert/strict';
import {evaluationCases} from '../src/eval/cases.mjs';import {runEvaluation,markdownReport} from '../src/eval/run.mjs';
test('evaluation fixtures are identical across models, with independently seeded phases',()=>{
 const a=evaluationCases(),b=evaluationCases();assert.equal(a.length,8);assert.deepEqual(a,b);
 assert.deepEqual(a.filter(c=>c.session.phase==='transfer').map(c=>c.answer),[{peakTorque:26318.95,touchdownOmegaA:5.24},{peakTorque:26318.95,touchdownOmegaA:5.24}]);
});
test('evaluation serializes targets, counts rejected outputs as failures and preserves case hashes',async()=>{
 const seen=[];let active=0,max=0;
 const results=await runEvaluation({targets:[{id:'a',provider:'ollama',model:'a'},{id:'b',provider:'ollama',model:'b'}],cases:evaluationCases().slice(0,2),call:async(id,args)=>{
  seen.push(id);max=Math.max(max,++active);await new Promise(r=>setImmediate(r));active--;
  if(id==='b')throw new Error('PRIVATE');
  const input=JSON.parse(args.input),zh=args.instructions.includes('Respond in Chinese');
  return {model:id,toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:input.explanation,feedback:zh?'请明确含义。':'Clarify the meaning.',question:zh?'指有限处还是无穷远？':'Finite inputs or infinity?',reason:zh?'先澄清范围。':'Clarify scope first.',focus:'meaning'})},usage:{input_tokens:10,output_tokens:20}};
 },unload:async id=>seen.push('unload:'+id)});
 assert.equal(max,1);assert.deepEqual(seen,['a','a','unload:a','b','b','unload:b']);assert.equal(results.models[0].passed,2);assert.equal(results.models[1].passed,0);
 assert.deepEqual(results.models[0].cases.map(c=>c.promptHash),results.models[1].cases.map(c=>c.promptHash));assert.doesNotMatch(JSON.stringify(results),/PRIVATE/);assert.match(markdownReport(results),/2\/2/);
});
test('uncertain inference halts the matrix and records incomplete status rather than switching models',async()=>{
 const calls=[];const results=await runEvaluation({targets:[{id:'a',model:'a',provider:'ollama'},{id:'b',model:'b',provider:'ollama'}],cases:evaluationCases(),call:async id=>{calls.push(id);throw Object.assign(new Error('timeout'),{uncertain:true});},unload:()=>assert.fail('cannot automatically unload after uncertain inference')});
 assert.deepEqual(calls,['a']);assert.equal(results.complete,false);assert.equal(results.models.length,1);assert.equal(results.models[0].attempted,1);
});
test('eval identifies wrong-source original quotations without saving rejected text or raw errors',async()=>{
 const c=evaluationCases().find(c=>c.id==='torque-transfer-en');
 const r=await runEvaluation({targets:[{id:'test',model:'test'}],cases:[c],call:async()=>({model:'test',toolCall:{name:'compare_reasoning',arguments:JSON.stringify({assessment:'supported',evidence:'I revise the zero-torque claim:',feedback:'Supported.',question:'What changed?',reason:'Check transfer.',focus:'transfer',priorEvidence:'I revise the zero-torque claim:',evidenceIds:['eval-evidence-0']})}})});
 assert.equal(r.models[0].passed,0);assert.equal(r.models[0].cases[0].validationReason,'original-quote');assert.doesNotMatch(JSON.stringify(r),/I revise the zero-torque claim:/);
});
test('eval retains bounded provider failure metadata without raw response, tool names or errors',async()=>{
 const r=await runEvaluation({targets:[{id:'test',provider:'ollama',model:'test'}],cases:evaluationCases().slice(0,1),call:async(_id,args)=>{
  args.onTrace?.({type:'request',body:{secret:'PRIVATE_REQUEST'}});
  args.onTrace?.({type:'response',status:200,body:{done:true,done_reason:'stop',message:{thinking:'PRIVATE_THINKING',content:'PRIVATE_TEXT',tool_calls:[{function:{name:'PRIVATE_TOOL',arguments:{secret:'PRIVATE_ARGUMENTS'}}}]}}});
  throw new Error('PRIVATE_ERROR');
 }});
 const c=r.models[0].cases[0];assert.equal(c.pass,false);assert.equal(c.providerDiagnostics?.httpStatus,200);assert.equal(c.providerDiagnostics?.requestSent,true);assert.equal(c.providerDiagnostics?.toolCallCount,1);assert.equal(c.providerDiagnostics?.allowedToolCall,false);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
