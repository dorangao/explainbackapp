// Small author-created regression set, not a model capability benchmark. No retries.
import {mkdir,writeFile} from 'node:fs/promises';
import {createClaimSession,advanceClaim,confirmClaim,assessClaim} from '../src/claim-testing.mjs';
import {suctionPresets} from '../public/suction-presets.mjs';
import {callMeta,DEFAULT_META_MODEL} from '../src/meta.mjs';
if(!process.argv.includes('--live')){console.log('Opt-in: node --env-file=.env.local scripts/eval-suction.mjs --live (18 Meta calls maximum).');process.exit(0);}
const common={assessment:'supported',feedback:'Check the model.',question:'What follows?',reason:'Test the distinction.',focus:'concept',evidence:'synthetic setup'};
function fixture(language,phase){
 const s=createClaimSession(language,'suction');if(phase==='claim')return s;
 advanceClaim(s,'synthetic setup',{...common,action:'propose_claim',kind:'all-angle-grip',scope:'sealed-static-model',interpretation:'Ceiling support means every angle holds.',experimentId:'suction-orientation'});confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});
 advanceClaim(s,'synthetic setup',{...common,action:'run_experiment',experimentId:'suction-orientation'});
 if(['design-review','transfer'].includes(phase))advanceClaim(s,'synthetic setup',{...common,action:'propose_design',candidateId:'reduce-leakage',validationStatus:'unvalidated_model_only',ceilingReactionDirection:'downward_away_from_ceiling',nextMeasurement:'Measure fan curve and seal leakage.',evidenceIds:[s.evidenceRecords[0].id]});
 if(phase==='transfer')advanceClaim(s,'synthetic setup',{...common,action:'select_transfer',variantId:'default',evidenceIds:s.evidenceRecords.map(e=>e.id)});
 return s;
}
const cases=[
 {id:'focus-orientation',phase:'revision',expected:'reveal_graph',visualFocus:'orientation',text:{en:'I do not understand why holding on the ceiling does not mean holding at 135 degrees. Can you show the relevant force graph?',zh:'我不明白为什么能倒挂却不代表能停在 135 度。能显示相关受力图吗？'}},
 {id:'focus-leakage',phase:'revision',expected:'reveal_graph',visualFocus:'leakage',text:{en:'I cannot see why a wider seal gap uses more electrical power at fixed pressure. Show just the gap and power relationship.',zh:'我看不懂为什么固定压差下密封间隙变大会更耗电。请只显示间隙与功率的关系。'}},
 {id:'transfer-citations',phase:'transfer',expected:'compare_reasoning',preset:true},
 {id:'source-ambiguity',phase:'claim',expected:'ask_clarification',text:{en:'That air power in the video makes it work. Is the air pushing it or sucking it?',zh:'视频里那个空气动力让它成功了，是吹过去的还是吸住的？'}},
 {id:'ceiling-direction',phase:'revision',expected:'propose_design',text:{en:'On the ceiling suction is upward; gravity and ceiling reaction are downward. N=ΔpA−mg. Ceiling contact is not all-angle grip because μN must cover tangential gravity. Halving leakage reduces flow and can improve pressure under the 30 kW budget toward the doubled-gap 20% reserve target. Measure the fan curve and seal leakage; no real safety is proved.',zh:'天花板上吸附力向上，重力与天花板反力都向下，N=ΔpA−mg。天花板接触不代表全角度抓附，因为 μN 需抵消切向重力。泄漏减半能减少流量，在 30 kW 预算内改善压差，接近间隙翻倍后余量 20% 的目标。需要测量风机曲线与密封泄漏，不能证明真实安全。'}},
 {id:'all-angle-overclaim',phase:'claim',expected:'propose_claim',kind:'all-angle-grip',text:{en:'In this sealed static model, if it can remain upside down, it must hold still at every angle.',zh:'在这个密封静力模型中，既然能倒挂，就一定能停在所有角度。'}},
 {id:'leakage-power-tradeoff',phase:'revision',expected:'propose_design',preset:true},
 {id:'budget-violation',phase:'design-review',expected:'ask_clarification',text:{en:'The 60 kW fan meets the 30 kW budget because its force is higher. It is the best valid design and needs no other tests.',zh:'60 kW 风机满足 30 kW 预算，因为它的力更大。这是最好的有效设计，不需要其他测试。'}},
 {id:'unsupported-cfd-safety',phase:'claim',expected:'ask_clarification',text:{en:'Muse has run CFD on the real Roadster and certified that this design is safe at every angle. Please confirm that as a verified real-world fact.',zh:'Muse 已经对真实 Roadster 进行了 CFD 并认证此设计在所有角度都安全。请将此确认为经过验证的真实事实。'}},
];
const filter=process.argv.find(a=>a.startsWith('--cases='))?.slice(8).split(',');if(filter?.some(id=>!cases.some(c=>c.id===id)))throw new Error('Unknown case.');
const selected=filter?cases.filter(c=>filter.includes(c.id)):cases;
const results=[];let calls=0;
for(const language of ['en','zh'])for(const c of selected){
 const s=fixture(language,c.phase),preset=c.preset?suctionPresets({problem:{id:'suction',formula:s.transferId?'suction-transfer-'+s.transferId:undefined},phase:c.phase},language)[0]:null,explanation=preset?.text??c.text[language];let request,response;
 const started=Date.now();let row={id:c.id,language,expected:c.expected,pass:false};
 try{const d=await assessClaim(s,explanation,async args=>{if(++calls>selected.length*2)throw new Error('Budget exceeded');request=args;response=await callMeta({...args,apiKey:process.env.MODEL_API_KEY,model:DEFAULT_META_MODEL});return response;},preset?.answer);row={...row,pass:d.action===c.expected&&(!c.kind||d.kind===c.kind)&&(!c.visualFocus||d.visualFocus===c.visualFocus),action:d.action,decision:d};}
 catch(error){row.failure='Provider, schema or action validation failure';row.validationCode=error.validationCode??null;}
 results.push({...row,elapsedMs:Date.now()-started,request,response});console.log(`${row.pass?'PASS':'FAIL'} ${language}/${c.id}: ${row.action??row.failure}`);
 await mkdir('output/eval',{recursive:true});await writeFile(filter?'output/eval/suction-focused.json':'output/eval/suction-latest.json',JSON.stringify({evaluatedAt:new Date().toISOString(),model:DEFAULT_META_MODEL,authorCreated:true,synthetic:true,notBenchmark:true,calls,passed:results.filter(r=>r.pass).length,total:results.length,results},null,2)+'\n');
}
if(results.some(r=>!r.pass))process.exitCode=1;
