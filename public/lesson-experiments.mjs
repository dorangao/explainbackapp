import {motionScenario,motionAt,motionAssumptions} from './motion.mjs';
import {flightScenario,rotationAt,contactAt,flightSummary,flightAssumptions} from './flight.mjs';
import {suctionScenario,orientationAt,suctionAssumptions} from './suction.mjs';
import {quantumCircuit} from './quantum.mjs';
import {quantumLesson,quantumFrameText,quantumCopy} from './quantum-content.mjs';
import {experimentIds} from './lesson-schema.mjs';

export const experimentNames={en:['Acceleration & distance','Sideways roll & torque','Landing force','Suction & orientation','One qubit','Quantum interference','Entanglement','Four-item search'],zh:['加速度与距离','侧向翻滚与力矩','着陆力','吸附与角度','一个量子比特','量子干涉','量子纠缠','四项搜索']};
export function lessonExperiment(id,variant=0,language='en'){
 if(!experimentIds.includes(id)||![0,1].includes(variant)||!['en','zh'].includes(language))throw new Error('Unsupported experiment.');
 const zh=language==='zh',say=(en,cn)=>zh?cn:en;
 const base={id,title:experimentNames[language][experimentIds.indexOf(id)],variant,verdict:'disagree',steps:100,axis:say('Progress through the modeled interval','模型区间进度'),unit:'',metrics:[]};
 const metric=(label,value,unit)=>({label,value,unit});
 if(id==='acceleration'){
  const s=motionScenario({duration:variant?2:1}),a=motionAt(s,'uniform',s.T),b=motionAt(s,'rising',s.T);
  return {...base,claim:say('Two cars reach the same speed in the same time, so they travel the same distance.','两辆车在相同时间达到相同速度，因此行驶距离一定相同。'),variants:[say('0–60 mph in 1 s','1 秒达到 60 mph'),say('0–60 mph in 2 s','2 秒达到 60 mph')],series:['A: v = Vt/T','B: v = V(t/T)²'],unit:'m/s',
   sample:u=>[motionAt(s,'uniform',u*s.T).velocity,motionAt(s,'rising',u*s.T).velocity],position:u=>[motionAt(s,'uniform',u*s.T).distance/(s.V*s.T/2),motionAt(s,'rising',u*s.T).distance/(s.V*s.T/2)],
   caption:u=>`t = ${(u*s.T).toFixed(2)} s · V = ${s.V.toFixed(3)} m/s`,metrics:[metric(say('A distance','A 距离'),a.distance,'m'),metric(say('B distance','B 距离'),b.distance,'m')],
   result:say('Same endpoints; different areas under velocity. A travels VT/2 and B travels VT/3. Acceleration is the slope, not the final speed.','端点相同，速度曲线下面积不同。A 行驶 VT/2，B 行驶 VT/3。加速度是斜率，不是最终速度。'),assumptions:motionAssumptions[language],
   transfer:{question:say('Fresh case: A reaches 12 m/s uniformly from rest in 3 s. How far does A travel?','新情境：A 从静止匀加速，3 秒达到 12 m/s。行驶距离是多少？'),answer:18,unit:'m',hint:'s = ½VT',tolerance:.01}};
 }
 if(id==='roll'){
  const s=flightScenario({massKg:variant?2800:2000}),summary=flightSummary(s);
  return {...base,claim:say('Finishing a full turn upright means the body has stopped spinning.','完成一整圈回到正立姿态，就意味着物体已停止旋转。'),variants:['m = 2000 kg','m = 2800 kg'],series:[say('A: coasting spin','A：匀速旋转'),say('B: controlled roll','B：受控翻滚')],unit:'rad/s',
   sample:u=>['coast','controlled'].map(mode=>rotationAt(s,mode,u*s.airtime).omega),rotation:u=>rotationAt(s,'controlled',u*s.airtime),
   caption:u=>{const r=rotationAt(s,'controlled',u*s.airtime);return `t = ${(u*s.airtime).toFixed(2)} s · τ = ${(r.torque/1000).toFixed(1)} kN·m`;},metrics:[metric(say('A final angular speed','A 最终角速度'),summary.touchdownOmegaA,'rad/s'),metric(say('B final angular speed','B 最终角速度'),0,'rad/s')],
   result:say('Orientation and angular velocity are different. A ends upright and spinning; the prescribed torque reverses to brake B to rest. This does not prove a safe landing.','姿态与角速度不同。A 回正时仍在旋转；B 的指定力矩反向制动，结束时角速度为零。这不能证明着陆安全。'),assumptions:flightAssumptions[language],
   transfer:{question:say('Fresh case: an ideal force couple has F = 200 N per force and separation d = 1.5 m. What torque magnitude does it exert?','新情境：理想力偶的每个力为 200 N，两力间距为 1.5 m。力矩大小是多少？'),answer:300,unit:'N·m',hint:'τ = Fd',tolerance:.01}};
 }
 if(id==='landing'){
  const massKg=variant?2800:2000,a=flightScenario({massKg,stopTime:.15}),b=flightScenario({massKg,stopTime:.6});
  return {...base,claim:say('The same change in momentum requires the same peak landing force.','动量变化相同，就需要相同的峰值着陆力。'),variants:['m = 2000 kg','m = 2800 kg'],series:['A: Δt = 0.15 s','B: Δt = 0.60 s'],unit:'kN',axis:say('Fraction of each stopping interval (different durations)','各自制停过程的比例（时长不同）'),
   sample:u=>[contactAt(a,u*a.stopTime).contactForce/1000,contactAt(b,u*b.stopTime).contactForce/1000],caption:u=>`t_A = ${(u*.15).toFixed(2)} s · t_B = ${(u*.6).toFixed(2)} s`,
   metrics:[metric(say('A peak contact force','A 峰值接触力'),flightSummary(a).peakContactForce/1000,'kN'),metric(say('B peak contact force','B 峰值接触力'),flightSummary(b).peakContactForce/1000,'kN')],
   result:say('Equal net impulse does not fix peak force. A longer stopping interval lowers the prescribed pulse peak but needs more stopping travel. Contact force includes weight.','相同净冲量不能确定峰值力。更长的制停时间降低指定脉冲的峰值，但需要更大的制停距离。接触力还包含支撑重力的部分。'),assumptions:flightAssumptions[language],
   transfer:{question:say('Fresh case: a 100 kg cart loses 2 m/s of downward speed in 0.5 s. What is the average upward NET force (exclude weight)?','新情境：100 kg 小车在 0.5 秒内消除 2 m/s 的向下速度。平均向上净力是多少（不含支撑重力部分）？'),answer:400,unit:'N',hint:'F_net,avg = mΔv/Δt',tolerance:.1}};
 }
 if(id==='suction'){
  const s=suctionScenario({mu:variant?.4:1}),ceiling=orientationAt(s,180);
  return {...base,claim:say('Enough suction to remain attached upside down guarantees holding at every surface angle.','吸力足以在倒置表面保持接触，就能保证在所有表面角度保持静止。'),variants:['μ = 1.0','μ = 0.4'],series:[say('Available friction μN','可用摩擦力 μN'),say('Gravity along surface','沿表面重力')],unit:'kN',axis:say('Separate static orientations: 0° → 180°','独立静力姿态：0° → 180°'),
   sample:u=>{const r=orientationAt(s,u*180);return [r.frictionCapacityN/1000,r.tangentialGravityN/1000];},caption:u=>`θ = ${(u*180).toFixed(0)}° · ΔpA = 24 kN`,
   metrics:[metric(say('Ceiling normal reaction','倒置时法向力'),ceiling.normalN/1000,'kN'),metric(say('Force needed for every angle','所有角度所需吸力'),ceiling.allAngleForceN/1000,'kN')],
   result:say('Ceiling contact is only one condition. On tilted surfaces friction must also oppose tangential gravity; look for where its required force exceeds capacity.','倒置接触只是一个条件。在倾斜表面，摩擦力还须平衡切向重力；寻找需求曲线超过容量曲线的位置。'),assumptions:suctionAssumptions[language],
   transfer:{question:say('Fresh window-cleaning robot: normal force N = 20 N, friction coefficient μ = 0.5. What is the maximum static friction?','新的擦窗机器人：法向力 N = 20 N，摩擦系数 μ = 0.5。最大静摩擦力是多少？'),answer:10,unit:'N',hint:'F_max = μN',tolerance:.01}};
 }
 const circuit=quantumCircuit({lesson:id,phase:variant?0:Math.PI,basis:variant?'X':'Z',target:variant?1:3}),lesson=quantumLesson(id,language),last=circuit.frames.length-1;
 const transfer=id==='qubit'?{question:say('Fresh H-prepared qubit: over 1000 fresh shots, how many 1 outcomes are expected on average (not guaranteed)?','新制备的 H 量子比特：独立制备并测量 1000 次，平均预计多少次得到 1（非保证值）？'),answer:500,unit:say('shots','次'),hint:'1000 × 0.5',tolerance:0}:
 id==='interference'?{question:say('Fresh H → P(π/2) → H circuit: what is the final probability of 0, in percent?','新电路 H → P(π/2) → H：最终测到 0 的概率是百分之几？'),answer:50,unit:'%',hint:'P(0) = [1 + cos(φ)]/2',tolerance:.001}:
 id==='entanglement'?{question:say('Fresh equal mixture of 00 and 11, measured in X on both qubits: how many 01 outcomes are expected on average in 800 independent shots?','新的 00 / 11 等比例经典混合态，在两个量子比特上都按 X 基独立测量 800 次：平均预计多少次出现 01？'),answer:200,unit:say('shots','次'),hint:'800 × ¼',tolerance:.001}:
 {question:say('Fresh math-only case: 16 outcomes have equal amplitude magnitude 1/4. What is one outcome’s probability, in percent?','新的纯数学情境：16 个结果的振幅大小均为 1/4。其中一个结果的概率是百分之几？'),answer:6.25,unit:'%',hint:'P = |a|²',tolerance:.001};
 return {...base,claim:lesson.claim,variants:id==='interference'?['φ = π','φ = 0']:id==='entanglement'?['Z basis','X basis']:id==='search'?['Target 11','Target 01']:[say('Standard preparation','标准制备'),say('Same preparation again','再次相同制备')],steps:last,series:circuit.labels.map(s=>`|${s}⟩`),unit:'%',axis:say('Discrete gate snapshots (not continuous gate dynamics)','离散量子门快照（非连续门动力学）'),
  sample:u=>circuit.frames[Math.round(u*last)].probabilities.map(p=>Math.min(100,Math.max(0,p*100))),caption:u=>quantumFrameText(circuit,Math.round(u*last),language),gates:circuit.frames.map(f=>f.gate),
  quantumState:circuit.frames[last].state,basisLabels:circuit.labels,reference:circuit.frames[last].reference?.map(p=>p*100),metrics:circuit.labels.map((label,i)=>metric(`|${label}⟩`,circuit.frames[last].probabilities[i]*100,'%')),result:lesson.why,assumptions:quantumCopy[language].limits,transfer};
}
