import {createHash} from 'node:crypto';
import {assess,advance} from '../learning.mjs';
import {CLAIM_PROMPT_VERSION} from '../claim-testing.mjs';
import {suiteVersion,evaluationCases} from './cases.mjs';
const mean=values=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null;
export async function runEvaluation({targets,cases=evaluationCases(),call,unload=async()=>{},onUpdate=async()=>{},metadata={},suite=suiteVersion}){
 const report={suiteVersion:suite,promptVersion:CLAIM_PROMPT_VERSION,startedAt:new Date().toISOString(),complete:false,plannedTargets:targets.map(t=>t.id),casesPerModel:cases.length,metadata,limitations:'Fixed synthetic developer smoke cases, one sample per case, no retries or model judge. Not a learning efficacy benchmark. Language check is a script proxy, not a fluency grade. Passing action/contract checks does not validate the factual accuracy of every feedback sentence; human review is required. Provider defaults and tokenizers differ.',models:[]};
 for(const target of targets){
  const row={id:target.id,provider:target.provider,model:target.model,attempted:0,passed:0,validOutputs:0,cases:[]};report.models.push(row);
  for(const item of cases){
   const s=structuredClone(item.session),start=performance.now();let response,decision,transportError=false;
   const result={id:item.id,language:item.language,expected:item.expected,pass:false,validOutput:false,promptHash:null};
   try{
    decision=await assess(s,item.text,async args=>{
     result.promptHash=createHash('sha256').update(JSON.stringify(args)).digest('hex');
     const diagnostics={requestSent:false,httpStatus:null,completion:null,toolCallCount:null,allowedToolCall:null,argumentsType:null};
     result.providerDiagnostics=diagnostics;
     const onTrace=event=>{
      if(event.type==='request')diagnostics.requestSent=true;
      if(Number.isInteger(event.status)&&event.status>=100&&event.status<=599)diagnostics.httpStatus=event.status;
      if(event.type==='response'){
       const body=event.body??{};
       if(typeof body.done==='boolean')diagnostics.completion=body.done?'completed':'incomplete';
       else if(['completed','incomplete','failed','cancelled'].includes(body.status))diagnostics.completion=body.status;
       const calls=Array.isArray(body.message?.tool_calls)?body.message.tool_calls.map(c=>c?.function):Array.isArray(body.output)?body.output.filter(c=>c?.type==='function_call'):null;
       if(calls){diagnostics.toolCallCount=Math.min(calls.length,100);diagnostics.allowedToolCall=calls.length===1&&args.tools.some(t=>t.name===calls[0]?.name);
        if(calls.length===1)diagnostics.argumentsType=Array.isArray(calls[0]?.arguments)?'array':calls[0]?.arguments===null?'null':typeof calls[0]?.arguments;
       }
      }
      args.onTrace?.(event);
     };
     try{return response=await call(target.id,{...args,onTrace});}catch(error){transportError=true;throw error;}
    },item.answer);
    advance(s,item.text,decision,item.answer);result.validOutput=true;row.validOutputs++;
    const prose=[decision.feedback,decision.question,decision.reason].join(' '),han=(prose.match(/\p{Script=Han}/gu)||[]).length;
    result.languageProxy=item.language==='zh'?han>=4:han===0;
    result.actual={action:decision.action,assessment:decision.assessment,...(decision.kind?{kind:decision.kind}:{}),phase:s.phase};
    result.checks=Object.fromEntries(Object.entries(item.expected).map(([k,v])=>[k,result.actual[k]===v]));
    result.pass=Object.values(result.checks).every(Boolean)&&result.languageProxy;
    result.feedback=decision.feedback;result.question=decision.question;
    if(decision.interpretation)result.interpretation=decision.interpretation;
    if(decision.priorEvidence)result.priorEvidence=decision.priorEvidence;
   }catch(error){result.error=error.uncertain?'uncertain-generation':transportError?'provider-failure':'output-validation';result.uncertain=Boolean(error.uncertain);if(!transportError&&['current-quote','original-quote'].includes(error.validationCode))result.validationReason=error.validationCode;}
   result.latencyMs=Math.round(performance.now()-start);
   if(response){result.actualModel=response.model;result.usage=response.usage;result.timings=response.timings;}
   row.cases.push(result);row.attempted++;if(result.pass)row.passed++;
   row.meanLatencyMs=mean(row.cases.map(c=>c.latencyMs));row.inputTokens=row.cases.reduce((n,c)=>n+(c.usage?.input_tokens??0),0);row.outputTokens=row.cases.reduce((n,c)=>n+(c.usage?.output_tokens??0),0);
   await onUpdate(report,result);
   if(result.uncertain){report.stoppedReason='Uncertain generation; no further model call or unload was attempted. Run npm run llm:recover before continuing.';report.finishedAt=new Date().toISOString();await onUpdate(report);return report;}
  }
  try{await unload(target.id);}catch{report.stoppedReason='Model unload could not be verified; no further model was started.';report.finishedAt=new Date().toISOString();await onUpdate(report);return report;}
 }
 report.complete=true;report.finishedAt=new Date().toISOString();await onUpdate(report);return report;
}
function failureDetail(c){
 const reason=c.validationReason??c.error??(c.pass?'—':Object.entries(c.checks??{}).filter(([,v])=>!v).map(([k])=>k).join(', ')||'language proxy');
 const d=c.providerDiagnostics;
 return !c.pass&&d?`${reason} (HTTP ${d.httpStatus??'—'}; tool calls ${d.toolCallCount??'—'})`:reason;
}
export function markdownReport(report){
 const lines=['# ExplainBack compact model comparison','',`Suite: ${report.suiteVersion} · prompt: ${report.promptVersion??'unversioned'} · ${report.startedAt}`,`Complete: ${report.complete}`,'',report.limitations,'','| Model | Contract checks passed / planned | Valid / attempted | Mean wall time | Input / output tokens |','| --- | --- | --- | --- | --- |'];
 for(const m of report.models)lines.push(`| ${m.id} | ${m.passed}/${report.casesPerModel} | ${m.validOutputs}/${m.attempted} | ${m.meanLatencyMs} ms | ${m.inputTokens} / ${m.outputTokens} |`);
 if(report.stoppedReason)lines.push('',report.stoppedReason);
 lines.push('','Wall time includes cold loading and validation. Token counts are not directly comparable across tokenizers. Raw provider responses, credentials, and hidden thinking are not stored.','','| Model | Case | Pass | Action | Failure | Wall time | Load time |','| --- | --- | --- | --- | --- | --- | --- |');
 for(const m of report.models)for(const c of m.cases)lines.push(`| ${m.model} | ${c.id} | ${c.pass} | ${c.actual?.action??'—'} | ${failureDetail(c)} | ${c.latencyMs} ms | ${c.timings?.loadMs??'—'} ms |`);
 return lines.join('\n')+'\n';
}
