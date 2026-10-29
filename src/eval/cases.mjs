import {createSession,advance,view} from '../learning.mjs';import {confirmClaim} from '../claim-testing.mjs';import {demoPresets} from '../../public/demo-presets.mjs';
export const suiteVersion='claim-mini-v1';
const common=(text,language)=>({assessment:'supported',evidence:text,feedback:language==='zh'?'这是固定评测上下文。':'Fixed evaluation context.',question:language==='zh'?'依据是什么？':'What is the evidence?',reason:language==='zh'?'检查推理。':'Check reasoning.',focus:'concept',model:'seeded-fixture'});
function canonical(s){
 const replacements=[[s.evidenceSessionId,'eval-session'],[s.claim?.id,'eval-claim'],...s.evidenceRecords.map((e,i)=>[e.id,'eval-evidence-'+i])].filter(([old])=>old);
 let json=JSON.stringify({...s,createdAt:0});for(const[from,to]of replacements)json=json.split(from).join(to);return JSON.parse(json);
}
function flight(language,phase){
 const s=createSession('flight',language,'claim-testing');s.demoUsed=true;
 if(phase==='claim')return canonical(s);
 const claim=demoPresets(view(s),language)[0].text;
 advance(s,claim,{...common(claim,language),action:'propose_claim',assessment:'misconception',kind:'rotation-torque',scope:'ideal-flight-and-contact',interpretation:claim,experimentId:'flight-torque'});
 confirmClaim(s,{claimId:s.claim.id,decision:'confirm',source:'scripted-demo'});
 if(phase==='prediction')return canonical(s);
 const prediction=language==='zh'?'我预测开始和结束的力矩都为零，所以过程中也为零。':'I predict zero torque throughout because the starting and ending spin are zero.';
 advance(s,prediction,{...common(prediction,language),action:'run_experiment',assessment:'misconception',experimentId:'flight-torque'});
 if(phase==='revision')return canonical(s);
 const revision=demoPresets(view(s),language)[0].text;
 advance(s,revision,{...common(revision,language),action:'select_transfer',variantId:'default',evidenceIds:[s.evidenceRecords[0].id]});
 return canonical(s);
}
export function evaluationCases(){
 const cases=[];
 for(const language of ['en','zh'])cases.push({id:'crossing-ambiguity-'+language,language,session:canonical(createSession('crossing',language,'claim-testing')),text:language==='en'?'It can never touch the asymptote.':'曲线永远碰不到渐近线。',expected:{action:'ask_clarification',assessment:'ambiguous',phase:'claim'}});
 cases.push({id:'torque-claim-en',language:'en',session:flight('en','claim'),text:'In this model B starts and ends with zero spin, so torque must be zero throughout its turn.',expected:{action:'propose_claim',assessment:'misconception',kind:'rotation-torque',phase:'confirm'}});
 cases.push({id:'landing-claim-zh',language:'zh',session:flight('zh','claim'),text:'在此竖直接触模型中，相同制停冲量意味着任何力曲线的平均力和峰值力都相同。',expected:{action:'propose_claim',assessment:'misconception',kind:'landing-impulse',phase:'confirm'}});
 cases.push({id:'torque-prediction-en',language:'en',session:flight('en','prediction'),text:'I predict zero torque throughout because the starting and ending spin are zero. Test that prediction.',expected:{action:'run_experiment',phase:'revision'}});
 const revision=flight('zh','revision');cases.push({id:'torque-revision-zh',language:'zh',session:revision,text:demoPresets(view(revision),'zh')[0].text,expected:{action:'select_transfer',assessment:'supported',phase:'transfer'}});
 const transfer=flight('en','transfer'),preset=demoPresets(view(transfer),'en')[0];
 cases.push({id:'torque-transfer-en',language:'en',session:transfer,text:preset.text,answer:{peakTorque:26318.95,touchdownOmegaA:5.24},expected:{action:'compare_reasoning',assessment:'supported',phase:'complete'}});
 cases.push({id:'correct-values-wrong-reasoning-zh',language:'zh',session:flight('zh','transfer'),text:'我填入了正确数值，但我仍认为净角冲量为零就证明每一瞬间力矩都为零，而且姿态回正就保证实车安全着陆。',answer:{peakTorque:26318.95,touchdownOmegaA:5.24},expected:{action:'ask_clarification',assessment:'ambiguous',phase:'transfer'}});
 return cases;
}
