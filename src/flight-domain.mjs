import {flightScenario,flightSummary,flightTitle} from '../public/flight.mjs';
const pair=(en,zh)=>({en,zh});
const local=(s,en,zh)=>s.language==='zh'?zh:en;
const scene=(s,variant=s.transferId)=>flightScenario(s.flightConfig,variant);
const fields={
 'rotation-torque':[{key:'peakTorque',label:pair('B peak |torque| (N·m)','B 峰值 |力矩| (N·m)')},{key:'touchdownOmegaA',label:pair('A angular speed at touchdown (rad/s)','A 接地时角速度 (rad/s)')}],
 'landing-impulse':[{key:'averageContactForce',label:pair('Average upward contact force (N)','平均向上接触力 (N)')},{key:'peakContactForce',label:pair('Peak upward contact force (N)','峰值向上接触力 (N)')}],
 'landing-state':[{key:'impactSpeed',label:pair('Downward speed at touchdown, magnitude (m/s)','接地时向下速度大小 (m/s)')},{key:'touchdownOmegaA',label:pair('A angular speed at touchdown (rad/s)','A 接地时角速度 (rad/s)')}],
};
const experiments={'rotation-torque':'flight-torque','landing-impulse':'flight-contact','landing-state':'flight-state'};
function part(s,variant=s.transferId){
 const c=scene(s,variant),pulse=c.landingProfile==='pulse',r=flightSummary(c);
 const expression=`m=${c.massKg} kg; T=${c.airtime} s; k=${c.radius} m; I=mk²; d=${c.separation} m; D=${c.stopTime} s; θ_A=2πt/T; θ_B=2πt/T−sin(2πt/T)`;
 const prompt=pair(`Compare a torque-free sideways roll A (initial ω=2π/T) with a rest-to-rest controlled turn B. Both return to the takeoff reference height. Contact uses ${pulse?'a cosine pulse of net upward acceleration':'constant net upward acceleration'} over D, with no rebound. Test a claim about torque, stopping force, or whether an upright angle is enough to establish a safe landing.`,
  `比较无力矩侧向横滚 A（初始 ω=2π/T）和从静止转到静止的受控旋转 B。两者回到起飞参考高度。接触阶段在 D 内采用${pulse?'余弦脉冲净向上加速度':'恒定净向上加速度'}，无反弹。检验关于力矩、制停力或“姿态回正是否足以说明安全着陆”的说法。`);
 const questions={
  'rotation-torque':pair('For this fresh scenario, calculate B’s peak absolute torque and A’s angular speed at touchdown. Explain Iα, the positive/negative torque, and why zero net angular impulse does not mean zero torque throughout.',
   '在这道新题中，计算 B 的峰值力矩绝对值和 A 接地时的角速度。解释 Iα、正负力矩，以及为何净角冲量为零不代表力矩始终为零。'),
  'landing-impulse':pair('For this fresh scenario, calculate average and peak upward contact force. Distinguish contact from net force and average from peak; explain how stopping time and force shape affect the result without claiming safety.',
   '在这道新题中，计算平均与峰值向上接触力。区分接触力与合力、平均值与峰值；解释制停时间和力的形状如何影响结果，不作安全结论。'),
  'landing-state':pair('For this fresh scenario, calculate the downward speed magnitude at touchdown and A’s angular speed there. Explain why angle alone cannot establish a safe landing, even when B stops spinning.',
   '在这道新题中，计算接地时向下速度的大小及 A 此时的角速度。解释为何仅凭角度不能说明安全着陆，即使 B 已停止旋转。'),
 };
 const transfer=questions[s.claim?.kind]??questions['landing-state'];
 return {formula:c.id,expression,prompt:variant?pair(`${prompt.en} ${transfer.en} Round to 0.01 and give your reasoning.`,`${prompt.zh} ${transfer.zh} 可四舍五入到0.01，并说明理由。`):prompt,
  purpose:variant?pair('Apply the distinction to new mass, flight time, inertia and stopping conditions.','将区别用于新的质量、飞行时间、转动惯量与制停条件。'):null,
  facts:`HYPOTHETICAL model, not measured vehicle data. ${expression}. g=9.80665. Up is positive. Rotation is about the longitudinal front-to-back roll axis; k is its radius of gyration. Opposed air jets illustrate the pure couple: exhaust is opposite reaction force, net force is zero, and the pair reverses to brake. Jets are off at zero torque and during contact. Gas storage, flow and actuator capability are unmodeled. Flight h=g*t*(T-t)/2 and vy=g*(T/2-t); downward impact speed U=gT/2. B alpha=(4π²/T²)sin(2πt/T); torque=I*alpha; each force in a pure perpendicular couple with separation d has magnitude |torque|/d. A has initial angular momentum before flight, zero airborne torque and residual spin. B's net angular impulse is zero but its torque is not identically zero. Contact is independent vertical-only: a=${pulse?'(U/D)(1-cos(2πq))':'U/D'}, q=(t-T)/D. N=mg+ma. Both contact shapes have average N=mg+mU/D, net impulse mU, contact impulse mU+mgD, travel UD/2; pulse peak=mg+2mU/D, constant peak=average. Endpoints are ideal one-sided values with force jumps; no rebound or roll/contact coupling. After touchdown A's rotation is unresolved, not stopped. Checked facts: ${JSON.stringify(r)}. Never equate these values with an occupant load or a real safe/feasible landing.`};
}
export const flightDomain={
 fields:s=>fields[s.claim?.kind]??fields['landing-state'],
 part,
 publicProblem:s=>{const p=part(s);return {id:'flight',title:flightTitle[s.language],expression:p.expression,prompt:p.prompt[s.language],formula:p.formula,purpose:p.purpose?.[s.language]??null};},
 graph:s=>({kind:'flight',scenario:scene(s)}),
 kinds:()=>Object.keys(experiments),experiments:()=>Object.values(experiments),eligible:(_s,kind,id)=>experiments[kind]===id,
 correct:s=>flightSummary(scene(s)),
 prediction:s=>s.claim.kind==='rotation-torque'?local(s,'Predict the sign of B’s torque early and late, and whether A or B is still spinning after one turn. Explain the role of inertia and the force couple.',
  '先预测 B 前半程和后半程力矩的符号，以及完成一圈后 A 或 B 是否仍在旋转。解释转动惯量与力偶的作用。'):
  s.claim.kind==='landing-impulse'?local(s,'Predict how doubling the stopping time changes average contact force and stopping travel. Does the same impulse fix the peak force?',
  '先预测制停时间翻倍会如何改变平均接触力与制停距离。相同冲量能决定峰值力吗？'):
  local(s,'Predict the angle, angular speed and downward velocity at touchdown for A and B. Is upright orientation alone enough to establish a safe landing?',
   '先预测 A、B 接地时的角度、角速度和向下速度。仅有姿态回正足以说明安全着陆吗？'),
 revision:s=>local(s,'Reconcile your claim with the checked torque, angular speed and contact forces. Which conclusions follow from this ideal model, and which real landing questions remain unresolved?',
  '结合已核验的力矩、角速度与接触力重新解释你的说法。哪些结论来自此理想模型？真实着陆还有哪些问题没有解决？'),
 instructions:()=>`This is a HYPOTHETICAL sideways-roll/landing lab, not measured vehicle data and not a safe-landing predictor. Scope is ideal-flight-and-contact. Map rotation-torque -> flight-torque, landing-impulse -> flight-contact, landing-state -> flight-state. Unsupported real vehicle guarantees require clarification. A begins with angular momentum and spins at 2π/T without airborne torque. B starts and ends at rest using an assumed external pure couple: tau=I alpha, I=mk², F_each=|tau|/d. This is roll about the longitudinal front-to-back axis; k is the roll radius of gyration. The animation depicts opposed air jets, with exhaust opposite the force on the body. Their forces cancel, their torques add, and direction reverses to brake. Jets are off at zero torque and during contact. No tank, gas-flow or actuator capability is established; exhaust is illustrative, not a flow simulation. The jets do not supply takeoff or landing lift. B's positive and negative torque integrate to zero angular impulse, not zero torque at all times. Angle 2π does not imply zero angular speed. Vertical motion is ballistic, U=gT/2 at touchdown; no horizontal motion or drag. Landing is a separate vertical-only no-rebound idealization: N_avg=mg+mU/D, not just mU/D. Peak depends on force shape: constant N_peak=N_avg, cosine pulse N_peak=mg+2mU/D. More stopping time lowers dynamic average force but needs more stopping travel UD/2. A's post-touchdown roll is unresolved; do not say it stops or lands safely. No suspension, body/occupant loads, structural or contact geometry model. Never certify safety, feasibility or comfort, even when B is upright with zero spin. Require explanation of the confirmed distinction, not just correct numbers. Fresh transfer fields depend on claim: rotation-torque peakTorque (N·m) and touchdownOmegaA (rad/s); landing-impulse averageContactForce and peakContactForce (N); landing-state impactSpeed magnitude (m/s) and touchdownOmegaA (rad/s). Numbers allow rounding to 0.01. Transfer settings replace primary settings. Do not disclose hidden transfer values before completion; graphs count as help.`,
 transfers:()=>[{id:'default',purpose:'New body: 1500 kg, 1.2 s flight, k=0.8 m, constant contact over 0.2 s.'},{id:'alternate',purpose:'New body: 1000 kg, 1 s flight, k=0.6 m, pulse contact over 0.4 s.'}],
};
