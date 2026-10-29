import {lessonExperiment} from './lesson-experiments.mjs';
import {validateDemo,compileExpression,evaluateExpression,validInputValue,formatDemoNumber} from './demo-model.mjs';
const compiled=new WeakMap();
function prepare(demo){
 if(compiled.has(demo))return compiled.get(demo);const d=validateDemo(demo);let names=[...d.inputs.map(v=>v.id),'x'];
 const formulas=d.outputs.map(o=>{const ast=compileExpression(o.expression,names);names.push(o.id);return {...o,ast};});
 const p={d,formulas};compiled.set(demo,p);return p;
}
export function chapterExperiment(chapter,variant=0,language='en',controls={},metric=0){
 if(chapter.experiment!=='generated')return lessonExperiment(chapter.experiment,variant,language);
 if(!['en','zh'].includes(language)||![0,1].includes(variant))throw new Error('Invalid demo setting.');
 const say=(en,zh)=>language==='zh'?zh:en,demo=chapter.demo;
 const base={id:'generated',generated:true,kind:demo.kind,title:demo.title[language],claim:demo.claim[language],assumptions:demo.assumptions[language],variants:[],metrics:[],steps:100};
 if(demo.kind==='process'){
  if(Object.keys(controls).length)throw new Error('A process has no numeric parameters.');const d=validateDemo(demo),index=u=>Math.round(u*(d.stages.length-1));
  return {...base,steps:d.stages.length-1,processStages:d.stages.map(s=>({title:s.title[language],detail:s.detail[language]})),series:[],unit:'',axis:'',sample:()=>[],caption:u=>d.stages[index(u)].detail[language],result:say('This is an authored process walkthrough. Its order and causal claims need review; running it does not validate them.','这是创作的过程演示。步骤顺序与因果关系需要审阅，播放并不能验证其正确性。'),transfer:{type:'choice',question:d.transfer.question[language],choices:d.transfer.choices.map(c=>c[language]),answer:d.transfer.answer,unit:'',hint:d.transfer.rationale[language],tolerance:0}};
 }
 const {d,formulas}=prepare(demo),values=Object.fromEntries(d.inputs.map(v=>[v.id,v.value]));
 if(variant===1)values[d.inputs[0].id]=d.inputs[0].value===d.inputs[0].max?d.inputs[0].min:d.inputs[0].max;
 if(!controls||typeof controls!=='object'||Array.isArray(controls)||Object.entries(controls).some(([id,value])=>!d.inputs.some(p=>p.id===id&&validInputValue(p,value))))throw new Error('Parameter outside the reviewed range.');Object.assign(values,controls);
 if(!Number.isInteger(metric)||metric<0||metric>=formulas.length)throw new Error('Unknown chart output.');
 const at=x=>{const env={...values,x};for(const o of formulas)env[o.id]=evaluateExpression(o.ast,env);return env;};
 const output=formulas[metric],xAt=u=>d.axis.min+u*(d.axis.max-d.axis.min),last=at(d.axis.max);
 const transferValues=Object.fromEntries(d.transfer.values.map(v=>[v.id,v.value]));
 // Keep the transfer different if the learner happens to select its original inputs.
 if(d.inputs.every(v=>values[v.id]===transferValues[v.id])){const p=d.inputs[0];transferValues[p.id]=transferValues[p.id]===p.min?p.max:p.min;}
 const transferEnv={...transferValues,x:d.transfer.at};for(const o of formulas)transferEnv[o.id]=evaluateExpression(o.ast,transferEnv);
 const transferOutput=formulas.find(o=>o.id===d.transfer.output),inputText=d.inputs.map(p=>`${p.label[language]} = ${transferValues[p.id]} ${p.unit}`).join(' · ');
 return {...base,inputs:d.inputs.map(p=>({...p,label:p.label[language],value:values[p.id]})),formulas:formulas.map(o=>({id:o.id,label:o.label[language],unit:o.unit,expression:o.expression})),metric,series:[output.label[language]],unit:output.unit,axis:`${d.axis.label[language]} (${d.axis.unit})`,axisEnds:[d.axis.min,d.axis.max],
  sample:u=>[at(xAt(u))[output.id]],caption:u=>`${d.axis.label[language]} = ${formatDemoNumber(xAt(u))} ${d.axis.unit} · ${output.label[language]} = ${formatDemoNumber(at(xAt(u))[output.id])} ${output.unit}`,
  metrics:formulas.map(o=>({label:o.label[language],value:last[o.id],unit:o.unit})),result:say('Calculated from the authored formulas, not independently validated science: ','按创作公式计算，未经独立科学验证：')+formulas.map(o=>`${o.label[language]} = ${formatDemoNumber(last[o.id])} ${o.unit}`).join(' · '),
  transfer:{type:'number',question:`${d.transfer.question[language]}\n${inputText}\n${d.axis.label[language]} = ${d.transfer.at} ${d.axis.unit} → ${transferOutput.label[language]}`,answer:transferEnv[d.transfer.output],unit:transferOutput.unit,hint:transferOutput.expression,tolerance:.005*Math.abs(transferEnv[d.transfer.output])}};
}
