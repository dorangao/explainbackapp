import {suctionPresets} from './suction-presets.mjs';
import {motionFormula,motionSummary,physicsSummary} from './motion.mjs';
import {flightFormula,flightSummary} from './flight.mjs';
const reasoning={
 'rotation-torque':[
  'I revise the zero-torque claim: τ=Iα, I=mk². Positive then negative torque changes and brakes B’s spin. Zero net angular impulse means IΔω=0, not zero torque throughout. Each assumed external couple force is |τ|/d. A retains its initial angular speed 2π/T even at angle 2π. No actuator capability or safe landing is established.',
  '我修正零力矩的说法：τ=Iα，I=mk²。正力矩加速旋转，负力矩使 B 停转。净角冲量为零表示 IΔω=0，不代表力矩始终为零。假设外力偶中每个力为 |τ|/d。A 在角度达到 2π 时仍有初始角速度 2π/T。这里不证明执行器能力或安全着陆。'],
 'landing-impulse':[
  'I revise the equal-force claim: U=gT/2 and ∫(N−mg)dt=mU. Average contact force is mg+mU/D, not just mU/D. Longer stopping time reduces dynamic average force but increases travel UD/2. At equal m, U and D, constant and cosine profiles share the average; their peaks differ: constant equals average, pulse peaks at mg+2mU/D. These are body contact forces, not occupant loads or a safety verdict.',
  '我修正平均力等于峰值的说法：U=gT/2，∫(N−mg)dt=mU。平均接触力是 mg+mU/D，不只是 mU/D。更长制停时间降低动态平均力，却增大行程 UD/2。在相同 m、U、D 下，恒定和余弦曲线平均值相同；恒定峰值等于平均值，脉冲峰值是 mg+2mU/D。这是物体接触力，不是乘员载荷，也不证明安全。'],
 'landing-state':[
  'I revise the upright claim: angle 2π does not imply zero angular speed. A retains 2π/T; B reaches zero spin using positive then negative torque. Both approach with downward speed U=gT/2. Vertical contact stops that velocity separately. Roll/contact coupling, suspension and structural loads are omitted, so upright alone cannot establish a safe landing.',
  '我修正姿态回正的说法：角度 2π 不表示角速度为零。A 仍有 2π/T，B 经正负力矩控制才停止旋转。两者接地时都具有向下速度 U=gT/2。竖直接触单独制停该速度，没有模拟横滚耦合、悬架和结构载荷，因此不能仅凭回正断言安全。'],
 'force-feasibility':[
  'I revise the mass claim: the same v(t) fixes a=dv/dt, but required force F=ma and wheel power P=Fv scale with mass. Weight is mg, not mass in kg. In the ideal tire limit F≤μmg, mass cancels, so required μ=a/g. Power is a separate limit. Passing these necessary ideal limits does not establish real feasibility or safety.',
  '我修正质量的说法：相同 v(t) 确定 a=dv/dt，但 F=ma 与轮端功率 P=Fv 都随质量增大。重量是 mg，不是以 kg 表示的质量。理想抓地限制 F≤μmg 中质量相消，所需 μ=a/g；功率是另一项限制。通过这些必要理想条件不代表实车可行或安全。'],
 'smoothness':[
  'I revise the comfort claim: jerk is da/dt, not acceleration itself. The cosine pulse has a=(V/T)(1−cos(2πt/T)) and j=(2πV/T²)sin(2πt/T), so a and j join rest/cruise at zero. Peak a is 2V/T and peak |j| is 2πV/T². Uniform acceleration has abrupt joins. Smooth joins still require force, grip and power checks and do not guarantee occupant comfort.',
  '我修正舒适度的说法：加加速度 j=da/dt，不是加速度。余弦脉冲 a=(V/T)(1−cos(2πt/T))，j=(2πV/T²)sin(2πt/T)，所以与静止、匀速衔接时 a、j 都为零。峰值 a=2V/T，峰值 |j|=2πV/T²。恒定加速度的衔接有突变。平滑衔接仍需检查力、抓地和功率，不能保证乘员舒适。'],
 motion:[
  'I revise the endpoint claim: equal final speed and duration fix only average acceleration V/T. Instantaneous acceleration is dv/dt, and distance is ∫v dt, so the whole curve matters. For cosine B and uniform A the total distances happen to agree at VT/2, but instantaneous accelerations differ; rising and falling profiles give different distances. Equal endpoints alone do not determine both.',
  '我修正端点的说法：相同末速度和时间只固定平均加速度 V/T。瞬时加速度为 dv/dt，路程为 ∫v dt，需要整条曲线。余弦 B 与恒定 A 的总路程恰好都是 VT/2，但瞬时加速度不同；递增或递减曲线的路程也不同。仅凭端点不能确定这些量。'],
};
export function demoPresets(s,language='en'){
 if(s?.problem.id==='suction')return suctionPresets(s,language);
 if(!s||!['flight','acceleration'].includes(s.problem.id)||['complete','confirm'].includes(s.phase))return [];
 const zh=language==='zh',i=zh?1:0,flight=s.problem.id==='flight';
 if(s.phase==='claim')return (flight?[
  ['Torque & spin','力矩与旋转','In this model B starts and ends with zero spin, so torque must be zero throughout its turn.','在本模型中 B 初末角速度都为零，所以横滚全程的力矩都为零。'],
  ['Landing force','着陆力','In this vertical-only model, equal stopping impulse means average and peak contact force must be identical for every shape.','在此竖直模型中，相同制停冲量意味着任何曲线的平均与峰值接触力都相同。'],
  ['Upright versus stopped','回正与停止','In this ideal model, angle 2π means both A and B have zero angular speed at touchdown.','在此理想模型中，角度 2π 表示 A、B 接地时角速度都为零。'],
 ]:[
  ['Mass & force','质量与力','If a heavier car follows exactly the same speed curve, it needs no extra force or power.','如果更重的车遵循相同速度曲线，就不需要额外的力或功率。'],
  ['Smooth joins','平滑衔接','In the prescribed cosine profile, smooth acceleration joins mean its peak acceleration must be lower than uniform A at the same V and T.','在规定的余弦曲线中，平滑衔接意味着相同 V、T 下峰值加速度一定低于恒定 A。'],
  ['Same endpoints','相同端点','Equal final speed and duration mean identical acceleration at every instant and the same distance.','相同末速度与时间意味着每一瞬间加速度相同，路程也相同。'],
 ]).map(p=>({label:p[i],text:p[i+2]}));
 if(s.phase==='prediction')return [{label:zh?'载入预测':'Load a prediction',text:flight?(zh?'我预测回正时 A、B 的角速度都为零，而且同样冲量必然得到同样峰值接触力。请用当前模型检验这个预测。':'I predict both objects have zero angular speed when upright, and equal impulse fixes the peak contact force. Test my prediction in this model.'):(zh?'我预测相同端点就意味着相同瞬时加速度；更重的车不需要更大力。请检验当前模型。':'I predict equal endpoints imply equal instantaneous acceleration and a heavier car needs no extra force. Test this against the current model.')}];
 let explanation=(reasoning[s.claim?.kind]??reasoning.motion)[i];
 if(s.phase==='revision')return [{label:zh?'载入依据证据的修正':'Load an evidence-based revision',text:explanation}];
 if(s.phase==='transfer'){
  let values;
  if(flight){const f=flightFormula(s.problem.formula);values=flightSummary(f);
   const numbers=`m=${f.massKg} kg, T=${f.airtime} s, D=${f.stopTime} s, I=${Number(values.inertia.toFixed(3))} kg·m², U=${Number(values.impactSpeed.toFixed(3))} m/s. `;
   const worked=s.claim?.kind==='landing-impulse'?`N_avg=mg+mU/D=${Number(values.averageContactForce.toFixed(2))} N; N_peak=${f.landingProfile==='constant'?'N_avg':'mg+2mU/D'}=${Number(values.peakContactForce.toFixed(2))} N. `:s.claim?.kind==='rotation-torque'?`|τ|_peak=I·4π²/T²=${Number(values.peakTorque.toFixed(2))} N·m; ω_A=2π/T=${Number(values.touchdownOmegaA.toFixed(2))} rad/s. `:`U=${Number(values.impactSpeed.toFixed(2))} m/s; ω_A=2π/T=${Number(values.touchdownOmegaA.toFixed(2))} rad/s. `;
   explanation=(zh?'本题代入：':'For this fresh scenario: ')+numbers+worked+explanation;
  }
  else {const m=motionFormula(s.problem.formula),p=physicsSummary(m,m.profileB);values={...motionSummary(m),peakForceB:p.peakForce,gripRequiredB:p.gripRequired,peakAccelerationB:p.peakAcceleration,peakJerkB:p.peakJerk};
   if(!['force-feasibility','smoothness'].includes(s.claim?.kind))explanation=zh?`在这道新题中，B 加速度${m.profileB==='falling'?'递减':'递增'}。相同端点只固定平均加速度 V/T，不固定瞬时加速度 dv/dt。路程必须积分速度：A 为 VT/2，B 为 ${m.profileB==='falling'?'2VT/3':'VT/3'}，所以 B−A=${values.distanceDifference.toFixed(2)} m。这是规定曲线的结果，不是实车性能结论。`:`In this fresh scenario B has ${m.profileB} acceleration. Equal endpoints fix average acceleration V/T, not instantaneous dv/dt. Integrating speed gives A distance VT/2 and B ${m.profileB==='falling'?'2VT/3':'VT/3'}, so B−A=${values.distanceDifference.toFixed(2)} m. These are prescribed curves, not a real vehicle performance claim.`;
  }
  const answer=Object.fromEntries(s.answerFields.map(f=>[f.key,Number(values[f.key].toFixed(2))]));
  return [{label:zh?'载入迁移示范（含数值）':'Load a worked transfer (with values)',text:explanation,answer},
   {label:zh?'请求图像帮助':'Ask for graph support',text:zh?'请显示这道新题的图像，帮助我比较；这次应记为辅助迁移。':'Please reveal the graph for this fresh problem; record this as assisted transfer.'}];
 }
 return [];
}
