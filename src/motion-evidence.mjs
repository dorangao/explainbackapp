import {motionFormula,motionAt,motionSummary,motionAssumptions,motionExpressions,physicsSummary} from '../public/motion.mjs';
const pair=(en,zh)=>({en,zh});
export const motionExperimentIds=['motion-acceleration','motion-distance','motion-force','motion-smoothness'];
export function executeMotionExperiment({sessionId,claimId,formulaId,experimentId,evidenceId}){
 if(![sessionId,claimId,evidenceId].every(x=>typeof x==='string'&&x.length>0&&x.length<=160)||!motionExperimentIds.includes(experimentId))throw new Error('Unsupported motion evidence.');
 const s=motionFormula(formulaId),f=motionExpressions(s),fmt=n=>Number(n.toFixed(4));
 const dynamics=['motion-force','motion-smoothness'].includes(experimentId);
 const witnessTime=s.T/(s.profileB==='smooth'?2:4);
 const result=dynamics?{A:physicsSummary(s,'uniform'),B:physicsSummary(s,s.profileB)}:
  {...motionSummary(s),witnessTime,witnessAccelerationA:motionAt(s,'uniform',witnessTime).acceleration,witnessAccelerationB:motionAt(s,s.profileB,witnessTime).acceleration};
 const accelerationB={rising:'2Vu/T',falling:'2V(1−u)/T',smooth:'(V/T)[1−cos(2πu)]'}[s.profileB];
 const distanceB={rising:'VT/3',falling:'2VT/3',smooth:'VT/2'}[s.profileB];
 let proof=pair(`${f.A}; ${f.B}, u=t/T. a=dv/dt: A=V/T; B=${accelerationB}. Integrating v from 0 to T: s_A=VT/2; s_B=${distanceB}. Average acceleration=(V−0)/T for both. These are analytic results of the prescribed profiles, not numerical sampling.`,
  `${f.A}；${f.B}，u=t/T。a=dv/dt：A=V/T；B=${accelerationB}。将 v 从0积分到T：s_A=VT/2；s_B=${distanceB}。两者平均加速度都是(V−0)/T。这是所设定曲线的解析结果，不是采样推断。`);
 let conclusion;
 if(experimentId==='motion-acceleration')conclusion=pair(
  `Both average ${fmt(result.averageAcceleration)} m/s². At t=${fmt(witnessTime)} s, A accelerates at ${fmt(result.witnessAccelerationA)} m/s² and B at ${fmt(result.witnessAccelerationB)} m/s². Equal average acceleration does not fix acceleration at every instant.`,
  `两者平均加速度均为 ${fmt(result.averageAcceleration)} m/s²。在 t=${fmt(witnessTime)} s 时，A 的加速度为 ${fmt(result.witnessAccelerationA)} m/s²，B 为 ${fmt(result.witnessAccelerationB)} m/s²。平均相同不能决定每一瞬间的加速度。`);
 if(experimentId==='motion-distance')conclusion=s.profileB==='smooth'?pair(
  `These different profiles have the same distance, ${fmt(result.distanceA)} m: both velocity integrals equal VT/2. Equal areas do not imply identical slopes. This pair alone does not refute a universal same-distance claim; rising/falling profiles provide counterexamples.`,
  `这两条不同的曲线路程相同，均为 ${fmt(result.distanceA)} m：速度积分都等于 VT/2。面积相同不代表斜率相同。这一组不能单独反驳“路程总相同”的说法；递增/递减曲线可提供反例。`):pair(
  `Both reach ${fmt(s.V)} m/s after ${s.T} s, but A travels ${fmt(result.distanceA)} m and B ${fmt(result.distanceB)} m. B−A=${fmt(result.distanceDifference)} m. Distance depends on the area under the full velocity curve, not endpoints alone.`,
  `两者都在 ${s.T} s 后达到 ${fmt(s.V)} m/s，但 A 行驶 ${fmt(result.distanceA)} m，B 行驶 ${fmt(result.distanceB)} m。B−A=${fmt(result.distanceDifference)} m。路程取决于完整速度曲线下的面积，不仅是端点。`);
 if(dynamics){
  const a=result.A,b=result.B;
  proof=pair(`${proof.en} F=ma; weight=mg; grip ceiling=μmg; wheel P=Fv; j=da/dt. Peak power uses endpoint extrema for uniform/rising, t=T(1−1/√3) for falling, and a²+vj=0 in (T/2,3T/4), solved by 60 bounded bisections, for the cosine pulse. Peak force and |jerk| are analytic. At the same v,a, doubling mass doubles F and P, while the ideal traction acceleration ceiling μg is unchanged.`,
   `${proof.zh} F=ma；重量=mg；抓地上限=μmg；轮端功率 P=Fv；j=da/dt。恒定/递增曲线的功率峰值在端点；递减曲线在 t=T(1−1/√3)；余弦脉冲在 (T/2,3T/4) 内满足 a²+vj=0，以60次有界二分求解。力和 |j| 的峰值为解析结果。在相同 v、a 下，质量翻倍使 F 和 P 翻倍，而理想抓地加速度上限 μg 不变。`);
  const status=(r,zh)=>r.withinLimits?(zh?'在两个理想上限内':'within both ideal limits'):(zh?`超出${!r.tractionOK?'抓地':''}${!r.tractionOK&&!r.powerOK?'和':''}${!r.powerOK?'功率':''}上限`:`exceeds ${[!r.tractionOK?'grip':null,!r.powerOK?'power':null].filter(Boolean).join(' and ')} limit(s)`);
  conclusion=experimentId==='motion-force'?pair(
   `Mass=${s.massKg} kg; weight=${fmt(a.weight)} N; grip ceiling=${fmt(a.tractionForce)} N; wheel power cap=${s.powerKw} kW. Peak force A/B=${fmt(a.peakForce)}/${fmt(b.peakForce)} N; peak wheel power A/B=${fmt(a.peakPowerKw)}/${fmt(b.peakPowerKw)} kW. A ${status(a,false)}; B ${status(b,false)}. Passing is only a necessary ideal check.`,
   `质量=${s.massKg} kg；重量=${fmt(a.weight)} N；抓地上限=${fmt(a.tractionForce)} N；轮端功率上限=${s.powerKw} kW。峰值力 A/B=${fmt(a.peakForce)}/${fmt(b.peakForce)} N；峰值轮端功率 A/B=${fmt(a.peakPowerKw)}/${fmt(b.peakPowerKw)} kW。A ${status(a,true)}；B ${status(b,true)}。通过仅表示满足理想必要条件。`):pair(
   `Peak acceleration A/B=${fmt(a.peakAcceleration)}/${fmt(b.peakAcceleration)} m/s²; peak in-interval |jerk|=${fmt(a.peakJerk)}/${fmt(b.peakJerk)} m/s³. A has zero jerk inside the interval but abrupt acceleration jumps at rest/cruise joins (ideal unbounded jerk). ${b.endpointJumps?'B also has an acceleration jump at a join.':'B joins rest/cruise with zero acceleration and jerk, but needs twice A’s peak acceleration for the same V,T.'} Smooth joins alone do not prove comfort or feasibility.`,
   `峰值加速度 A/B=${fmt(a.peakAcceleration)}/${fmt(b.peakAcceleration)} m/s²；区间内峰值 |j|=${fmt(a.peakJerk)}/${fmt(b.peakJerk)} m/s³。A 在区间内 j=0，但起步/匀速衔接时加速度突变（理想 j 无界）。${b.endpointJumps?'B 在一个衔接处也有加速度突变。':'B 衔接时加速度与 j 都为零，但在相同 V、T 下需要 A 两倍的峰值加速度。'}平滑衔接本身不能证明舒适或可行。`);
 }
 return {version:1,id:evidenceId,sessionId,claimId,formulaId,formulaVersion:2,experimentId,method:dynamics?'ideal-force-and-jerk-v1':'prescribed-velocity-calculus-v1',
  inputs:{V:s.V,T:s.T,profileA:'uniform',profileB:s.profileB,massKg:s.massKg,grip:s.grip,powerKw:s.powerKw,units:{velocity:'m/s',time:'s',acceleration:'m/s²',distance:'m',mass:'kg',force:'N',power:'kW',jerk:'m/s³'}},result,proof,conclusion,
  limitations:pair(`${motionAssumptions.en} Jerk is a motion descriptor, not a comfort score; real feel also depends on duration, seating and suspension. This does not verify a learner's understanding.`,
   `${motionAssumptions.zh} 加加速度是运动描述量，不是舒适度评分；体感还取决于持续时间、座椅与悬架。这也不证明学习者理解正确。`)};
}
