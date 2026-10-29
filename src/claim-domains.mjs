import {suctionDomain} from './suction-domain.mjs';
import {flightDomain} from './flight-domain.mjs';
import {problemPart,publicProblem,graphData} from './problems.mjs';
import {motionScenario,motionSummary,motionExpressions,motionTitle,motionAssumptions,physicsSummary} from '../public/motion.mjs';
const pair=(en,zh)=>({en,zh});
const text=(s,en,zh)=>s.language==='zh'?zh:en;
const crossingAnswerFields=[{key:'asymptote',label:pair('Horizontal asymptote y =','水平渐近线 y =')},{key:'crossingX',label:pair('Crossing input x =','穿越点的输入 x =')}];
const motionAnswerFields=[{key:'averageAcceleration',label:pair('Average acceleration (m/s²)','平均加速度 (m/s²)')},{key:'distanceDifference',label:pair('Distance B − A (m)','路程 B − A (m)')}];
export function isSuction(s){return s.problemId==='suction';}
export function isFlight(s){return s.problemId==='flight';}
export function isMotion(s){return s.problemId==='acceleration';}
const dynamicsKind=s=>['force-feasibility','smoothness'].includes(s.claim?.kind);
const motionFor=(s,variant=s.transferId)=>motionScenario(s.motionConfig,variant&&dynamicsKind(s)?`dynamics-${variant}`:variant);
const forceFields=[{key:'peakForceB',label:pair('B peak required force (N)','B 所需峰值力 (N)')},{key:'gripRequiredB',label:pair('B minimum ideal grip coefficient μ (unitless)','B 最小理想抓地系数 μ（无量纲）')}];
const smoothFields=[{key:'peakAccelerationB',label:pair('B peak acceleration (m/s²)','B 峰值加速度 (m/s²)')},{key:'peakJerkB',label:pair('B peak |jerk| (m/s³)','B 峰值 |加加速度| (m/s³)')}];
export function answerFields(s){if(isSuction(s))return suctionDomain.fields(s);if(isFlight(s))return flightDomain.fields(s);return !isMotion(s)?crossingAnswerFields:s.claim?.kind==='force-feasibility'?forceFields:s.claim?.kind==='smoothness'?smoothFields:motionAnswerFields;}
export function answerShapeValid(s,answer){return Boolean(answer&&typeof answer==='object'&&!Array.isArray(answer)
 &&Object.keys(answer).sort().join(',')===answerFields(s).map(f=>f.key).sort().join(',')&&Object.values(answer).every(Number.isFinite));}
export function motionPart(s,variant=s.transferId){
 const m=motionFor(s,variant),expressions=motionExpressions(m),summary=motionSummary(m),physics={A:physicsSummary(m,'uniform'),B:physicsSummary(m,m.profileB)};
 const prompt=pair(`${m.context.en}: A and B start from rest and reach ${m.speedLabel} after T=${m.T} s. Compare average versus instantaneous acceleration and the distance each travels. Explain what the endpoint speeds do and do not tell you. You can also test a claim about mass, required force/power, or smoothness.`,
  `${m.context.zh}：A 和 B 都从静止开始，在 T=${m.T} s 后达到 ${m.speedLabel}。比较平均与瞬时加速度、各自行驶的路程，解释端点速度能说明什么、不能说明什么。也可以检验关于质量、所需力/功率或平滑度的说法。`);
 let transferPrompt=pair(`${prompt.en} Enter their shared average acceleration in m/s² and signed distance B−A in m (round to 0.01). Explain using slopes/areas; equal endpoints alone are not enough.`,
  `${prompt.zh} 请填写共同的平均加速度（m/s²）和带正负号的路程差 B−A（m），可四舍五入到0.01。用斜率或面积解释，不能仅凭端点判断。`);
 if(s.claim?.kind==='force-feasibility')transferPrompt=pair(`${m.context.en}: from rest to ${m.speedLabel} in ${m.T} s. For B, enter peak required force in N and minimum ideal grip coefficient μ (round to 0.01). Explain mass versus weight, F=ma, the tire limit and why power must also be checked. Passing these limits is not proof of real feasibility.`,
  `${m.context.zh}：从静止到 ${m.speedLabel}，用时 ${m.T} s。请填写 B 所需峰值力（N）与最小理想抓地系数 μ（可四舍五入到0.01）。解释质量与重量、F=ma、轮胎上限，以及为何还要核验功率。通过上限不证明真实可行。`);
 if(s.claim?.kind==='smoothness')transferPrompt=pair(`${m.context.en}: from rest to ${m.speedLabel} in ${m.T} s. For B, enter peak acceleration and peak absolute jerk (round to 0.01). Use the sine/cosine derivatives to explain the rest/cruise joins and the peak-demand tradeoff. Do smooth joins guarantee comfort or feasibility?`,
  `${m.context.zh}：从静止到 ${m.speedLabel}，用时 ${m.T} s。请填写 B 的峰值加速度和峰值加加速度绝对值（可四舍五入到0.01）。用正弦/余弦导数解释起步、匀速衔接与峰值需求的取舍。平滑衔接能保证舒适或可行吗？`);
 return {formula:m.id,expression:`V = ${m.speedLabel}; T = ${m.T} s; ${expressions.A}; ${expressions.B}; m = ${m.massKg} kg; μ = ${m.grip}; P_max = ${m.powerKw} kW`,
  prompt:variant?transferPrompt:prompt,purpose:variant&&dynamicsKind(s)?pair('Apply force or smoothness reasoning to new mass, units and timing.','将力或平滑度推理用于新的质量、单位与时间。'):variant?pair('Apply the distinction to a different everyday context, unit and motion profile.','将这一区别用于新的生活情境、单位和运动曲线。'):null,
  facts:`HYPOTHETICAL prescribed 1D motion, not measured vehicle telemetry. SI V=${m.V} m/s, T=${m.T} s; m=${m.massKg} kg, μ=${m.grip}, wheel cap=${m.powerKw} kW. ${expressions.A}; ${expressions.B}. a=dv/dt; distance is integral of v; j=da/dt; F=ma; weight=mg; grip cap=μmg; wheel P=Fv. Checked motion: ${JSON.stringify(summary)}. Checked physics: ${JSON.stringify(physics)}. Smooth uses a=(V/T)(1-cos(2πt/T)), j=(2πV/T²)sin(2πt/T); both vanish at joins, but peak a is double uniform. At endpoints use one-sided derivatives; non-smooth profiles jump when joined to rest/cruise. Correct values alone are insufficient. Cosine and uniform have EQUAL total distance despite different slopes; never claim this pair refutes equal distances. ${motionAssumptions.en}`};
}
export function domainPart(s,variant=s.transferId){if(isSuction(s))return suctionDomain.part(s,variant);if(isFlight(s))return flightDomain.part(s,variant);return isMotion(s)?motionPart(s,variant):problemPart('crossing',variant);}
export function primaryFormula(s){return domainPart(s,null).formula;}
export function domainPublicProblem(s){if(isSuction(s))return suctionDomain.publicProblem(s);
 if(isFlight(s))return flightDomain.publicProblem(s);
 if(!isMotion(s))return publicProblem('crossing',s.language,s.transferId);
 const p=motionPart(s);return {id:'acceleration',title:motionTitle[s.language],expression:p.expression,prompt:p.prompt[s.language],formula:p.formula,purpose:p.purpose?.[s.language]??null};
}
export function domainGraph(s){if(isSuction(s))return suctionDomain.graph(s);if(isFlight(s))return flightDomain.graph(s);return isMotion(s)?{kind:'motion',scenario:motionFor(s)}:graphData('crossing',s.transferId);}
export function domainKinds(s){if(isSuction(s))return suctionDomain.kinds(s);if(isFlight(s))return flightDomain.kinds(s);return isMotion(s)?['average-vs-instantaneous','same-endpoints-distance','force-feasibility','smoothness']:['finite-equality','finite-crossing','end-behavior'];}
export function domainScopes(s){if(isSuction(s))return ['sealed-static-model'];if(isFlight(s))return ['ideal-flight-and-contact'];return isMotion(s)?['prescribed-motion-interval']:['finite-inputs','end-behavior'];}
export function domainExperiments(s){if(isSuction(s))return suctionDomain.experiments(s);if(isFlight(s))return flightDomain.experiments(s);return isMotion(s)?['motion-acceleration','motion-distance','motion-force','motion-smoothness']:['finite-equality','finite-crossing','end-behavior'];}
export function eligibleExperiment(s,kind,id){
 if(isSuction(s))return suctionDomain.eligible(s,kind,id);
 if(isFlight(s))return flightDomain.eligible(s,kind,id);
 if(isMotion(s))return id===({'average-vs-instantaneous':'motion-acceleration','same-endpoints-distance':'motion-distance','force-feasibility':'motion-force','smoothness':'motion-smoothness'})[kind];
 return (kind==='finite-equality'?['finite-equality','finite-crossing']:[kind]).includes(id);
}
export function expectedScope(s,kind){if(isSuction(s))return 'sealed-static-model';if(isFlight(s))return 'ideal-flight-and-contact';return isMotion(s)?'prescribed-motion-interval':kind==='end-behavior'?'end-behavior':'finite-inputs';}
export function answerCorrect(s,answer){
 if(!answerShapeValid(s,answer))return false;
 if(isSuction(s)){const r=suctionDomain.correct(s);return answerFields(s).every(f=>Math.abs(answer[f.key]-r[f.key])<=.0100000001);}
 if(isFlight(s)){const r=flightDomain.correct(s);return answerFields(s).every(f=>Math.abs(answer[f.key]-r[f.key])<=.0100000001);}
 if(isMotion(s)){
  const m=motionFor(s),p=physicsSummary(m,m.profileB);
  const result={...motionSummary(m),peakForceB:p.peakForce,gripRequiredB:p.gripRequired,peakAccelerationB:p.peakAcceleration,peakJerkB:p.peakJerk};
  return answerFields(s).every(f=>Math.abs(answer[f.key]-result[f.key])<=.0100000001);
 }
 const p=problemPart('crossing',s.transferId);return answer.asymptote===p.asymptote&&answer.crossingX===p.crossings[0];
}
export function predictionPrompt(s){if(isSuction(s))return suctionDomain.prediction(s);
 if(isFlight(s))return flightDomain.prediction(s);
 if(isMotion(s)&&s.claim?.kind==='force-feasibility')return text(s,'Predict whether the selected mass and motion stay within the grip and wheel-power limits for the whole interval. What would doubling mass change at the same motion?',
  '先预测：所选质量和运动在整个区间内能满足抓地与轮端功率上限吗？相同运动下，质量翻倍会改变什么？');
 if(isMotion(s)&&s.claim?.kind==='smoothness')return text(s,'Predict the acceleration and jerk at the start, middle and end. Would a smoother join necessarily mean lower peak force or a comfortable ride?',
  '先预测起点、中点和终点的加速度与加加速度。更平滑的衔接一定意味着更小的峰值力或更舒适的乘坐吗？');
 if(isMotion(s))return text(s,'Before checking, predict: do A and B have the same acceleration at t=T/4? Does the same final speed in the same time imply the same distance? Explain your prediction.',
  '核验前先预测：在 t=T/4 时 A 和 B 的加速度相同吗？同样时间达到同样末速度，路程一定相同吗？请解释。');
 return s.claim.experimentId==='end-behavior'?text(s,'Predict the limit at each end. Explain why you expect that behavior.','先预测两端的极限，并解释为什么。'):
  text(s,'Predict whether the curve equals or crosses y=0 at x=0. Explain your prediction before we check.','先预测曲线是否在 x=0 处与 y=0 相等或穿过它，并解释理由，再进行核验。');
}
export function revisionPrompt(s){if(isSuction(s))return suctionDomain.revision(s);
 if(isFlight(s))return flightDomain.revision(s);
 if(isMotion(s)&&dynamicsKind(s))return text(s,'Use the checked force, power and jerk evidence to revisit your claim. Explain what mass and profile shape change, and what these ideal checks cannot establish about a real car or comfort.',
  '用已核验的力、功率与加加速度证据重新解释你的说法。说明质量与曲线形状改变了什么，以及这些理想核验不能证明实车或舒适度的哪些方面。');
 return isMotion(s)?text(s,'Reconcile your claim with the checked averages, slopes and areas. What do the endpoint speeds fail to determine?','结合已核验的平均值、斜率和面积重新解释你的说法。端点速度不能决定什么？'):
 text(s,'What does this evidence establish about your claim, and what does it not establish? Explain finite input versus end behavior.','这些证据对你的说法说明了什么、没有说明什么？请区分有限输入与无穷远处的行为。');}
export function domainInstructions(s){if(isSuction(s))return suctionDomain.instructions(s);if(isFlight(s))return flightDomain.instructions(s);return isMotion(s)?`This is a HYPOTHETICAL vehicle-motion lab, not measured vehicle data or manufacturer specifications. Model only prescribed 1D motion and necessary ideal force/power limits. Never conclude real-car feasibility, safety, comfort, rotation or landing. Capture average-vs-instantaneous -> motion-acceleration; same-endpoints-distance -> motion-distance; force-feasibility -> motion-force; smoothness -> motion-smoothness, all scope prescribed-motion-interval. Clarify unsupported real-vehicle claims. After prediction, use server evidence. Force reasoning must distinguish mass (kg) from weight (N), use F=ma, grip<=μmg and wheel P=Fv, and explain that passing both is only necessary in this simplified model. Mass scales force/power; it cancels from the ideal traction acceleration limit μg. Smoothness reasoning must distinguish jerk (da/dt) from acceleration; uniform has zero INTERIOR jerk but acceleration jumps at rest/cruise joins. Cosine pulse a=(V/T)(1-cos(2πt/T)) has zero acceleration and jerk at joins but twice uniform peak acceleration, so no automatic comfort or feasibility verdict. Sine/cosine is one choice, not required; polynomial profiles can also smooth joins. Cosine and uniform have EQUAL integrated distances; do not falsely refute a same-distance claim from that pair. Require reasoned evidence reconciliation before transfer. For force transfer, numeric fields are peakForceB in N and gripRequiredB (unitless); smoothness fields peakAccelerationB in m/s² and peakJerkB in m/s³. Other motion fields are averageAcceleration and signed distanceDifference B-A. All allow rounding to 0.01. Correct numbers alone are insufficient; inspect reasoning and qualify limits. Transfer changes the scenario; its settings are independent of the primary. Graphs count as help. Never disclose hidden transfer values in hints.`:
 `For 'never touches', distinguish finite input from end behavior. Choose finite-crossing to test an uncrossable boundary, finite-equality for equality only, end-behavior for end limits. Equality alone does not prove crossing, and a plot is not proof of a limit. Require reasoning about finite crossing versus end behavior. Learner transfer fields are asymptote and crossingX.`;}
export function transferOptions(s){if(isSuction(s))return suctionDomain.transfers(s);
 if(isFlight(s))return flightDomain.transfers(s);
 if(isMotion(s)&&dynamicsKind(s))return [{id:'default',purpose:'Everyday cars: 1500 kg, 72 km/h in 5 s, cosine pulse.'},{id:'alternate',purpose:'Compact cars: 1200 kg, 36 km/h in 4 s, cosine pulse.'}];
 return isMotion(s)?[
 {id:'default',purpose:'Hypothetical e-bikes, km/h units, falling acceleration.'},{id:'alternate',purpose:'Hypothetical test carts, km/h units, rising acceleration.'}]:[
 {id:'default',purpose:'Change the asymptote height and crossing input.'},{id:'alternate',purpose:'Use a negative asymptote and a negative crossing input.'}];}
