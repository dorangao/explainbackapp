import {suctionScenario,suctionTitle,suctionSummary,suctionAssumptions,robotResult} from '../public/suction.mjs';
const pair=(en,zh)=>({en,zh});
const scenario=(s,variant=s.transferId)=>suctionScenario(s.suctionConfig,variant);
const fields=[{key:'minPressurePa',label:pair('Minimum pressure deficit Δp (Pa)','最小压差 Δp (Pa)')},{key:'frictionAtPressureN',label:pair('Friction capacity at given Δp (N)','给定压差下的摩擦力上限 (N)')}];
function part(s,variant=s.transferId){
 const m=scenario(s,variant),transfer=Boolean(variant);
 return {formula:m.id,expression:transfer?`m=${m.massKg} kg; A=${m.areaM2} m²; μ=${m.mu}; Δp=${m.pressurePa} Pa`:`Fₛ=ΔpA; N=Fₛ+mg cosθ; μN ≥ mg|sinθ|`,
 prompt:transfer?pair(`A hypothetical window-cleaning robot rests on a vertical wall. Find the minimum pressure deficit and friction capacity at the given pressure (round to 0.01). Explain why suction greater than weight does not establish wall grip.`,
 '假想擦窗机器人停在竖直墙面。求最小压差、给定压差下的摩擦力上限（可保留两位小数）。解释为什么吸附力大于重量不能证明墙面抓附足够。'):
 pair(`Can stationary suction hold a car at every angle? Test a claim, inspect the force balance, then compare designs under leakage and power limits. Pinned inputs: m=${m.massKg} kg, A=${m.areaM2} m², Δp=${m.pressurePa} Pa, μ=${m.mu}, gap=${m.gapMm} mm.`,
 `静止吸附能让汽车停在每个角度吗？检验说法、观察受力，再在泄漏和功率限制下比较设计。固定参数：m=${m.massKg} kg、A=${m.areaM2} m²、Δp=${m.pressurePa} Pa、μ=${m.mu}、间隙=${m.gapMm} mm。`),
 purpose:transfer?pair('Fresh transfer: ceiling normal force becomes wall friction.','新情境迁移：从天花板法向力转向墙面摩擦力。'):null,
 facts:JSON.stringify({scenario:m,checked:transfer?robotResult(m):suctionSummary(m),assumptions:suctionAssumptions.en})};
}
export const suctionDomain={
 fields:()=>fields,part,
 publicProblem(s){const p=part(s);return {id:'suction',title:suctionTitle[s.language],expression:p.expression,prompt:p.prompt[s.language],formula:p.formula,purpose:p.purpose?.[s.language]??null};},
 graph:s=>({kind:'suction',scenario:scenario(s),focus:s.transferId?'robot':s.suctionFocus??({'stationary-pressure':'pressure','leakage-power':'leakage'}[s.claim?.kind]??'orientation')}),
 kinds:()=>['stationary-pressure','all-angle-grip','leakage-power'],experiments:()=>['suction-static','suction-orientation','suction-leakage'],
 eligible:(_s,kind,id)=>({'stationary-pressure':'suction-static','all-angle-grip':'suction-orientation','leakage-power':'suction-leakage'})[kind]===id,
 correct:s=>robotResult(scenario(s)),
 prediction:s=>pair('Predict what happens at rest, on the ceiling, at 135°, and when the effective gap doubles. Which force or power balance could disprove your claim?',
 '先预测静止、天花板、135° 倾斜，以及有效间隙翻倍时的情况。哪一个力或功率平衡能反驳你的说法？')[s.language],
 revision:s=>pair('Use the checked evidence to revise your claim. Propose one catalog design to screen for a 20% ceiling normal-force reserve at doubled gap, within 30 kW. How could the improvement be achieved, with what tradeoff, and what should be measured next?',
 '依据核验证据修正说法。从目录提出一种设计：间隙翻倍后，天花板法向力余量达到重量的 20%，且功率不超过 30 kW。如何实现改进，有什么代价，下一步应测量什么？')[s.language],
 transfers:()=>[{id:'default',purpose:'Window-cleaning robot: 2 kg, 0.02 m², μ=0.4, 2000 Pa.'},{id:'alternate',purpose:'Different window-cleaning robot: 3 kg, 0.03 m², μ=0.5, 1500 Pa.'}],
 instructions:()=>`This is a hypothetical sealed-surface static suction lab, not measured vehicle engineering or CFD. Ambiguous 'air power', real-car guarantees, claims of demonstrated safety, or unspecified suction versus airflow require clarification. Clear model-scoped claims, including false ones, must be proposed faithfully. Map stationary-pressure to suction-static, all-angle-grip to suction-orientation, leakage-power to suction-leakage; scope sealed-static-model.
When a learner asks for help with an already checked result, use reveal_graph and choose visualFocus: pressure for ΔpA, orientation for contact/friction/angles, leakage for gap/power, design for an available comparison, robot only during transfer. Keep feedback to one short observation (aim for 180 characters), then one concrete question. Do not restate the whole model or disclose transfer answers.
Separate passive aerodynamic force (0.5 rho v_air² S C_down) from sealed fan-induced ΔpA. At zero external relative airflow passive force vanishes, but powered suction can exist. These are separate models, never an independently calibrated sum. No airborne seal/thrust inference.
Forces ON THE CAR: suction toward surface, gravity downward, reaction away from surface. At the ceiling suction is upward, while gravity AND ceiling reaction are DOWNWARD. Use ceilingReactionDirection=downward_away_from_ceiling. N=Fs+mg cosθ must be nonnegative; friction capacity μN must cover mg|sinθ|. Ceiling success does not imply every angle. At default 135° normal is 10131.30 N but tangential gravity is 13868.70 N: static equilibrium impossible. This is a static sequence, no falling dynamics or centripetal force.
Q=Cd Lh sqrt(2Δp/rho); electrical P=ΔpQ/η_total with η_total=0.6. At fixed pressure doubling gap doubles power. At fixed power pressure drops by 2^(-2/3). The pressure bound is optimistic without a fan curve, not actual capability. No zero-gap perfect seal or above-range claims.
Design objective ONLY: stationary inverted force >=1.2mg at doubled gap, within 30 kW; 20% is a teaching target, not a safety factor. Catalog: original, double-power (60 kW, violates budget), reduce-leakage (half effective leakage), reduce-mass (20% lighter). Ask how the improvement could be achieved and what should be measured. A compliant segmented skirt is only one possible reduce-leakage hypothesis; clearance, wear and debris contact are tradeoffs, not validated facts. Third call proposes one catalog candidate with a measurable next check; code then computes ALL candidates. Use validationStatus=unvalidated_model_only. At design-review reconcile actual results, budget and reserve before selecting transfer; cite BOTH the original experiment and suction-design record. Reduced leakage passing is a hypothesis, not optimality, an all-angle result or certification. A fan curve and seal leakage/clearance test are needed; CFD/wind-tunnel measurements remain independent validation, not something Muse has performed.
Transfer is a fresh vertical-wall window robot: N=ΔpA and friction μN must balance mg. Minimum Δp=mg/(μA). A ceiling condition Fs>=mg is insufficient on a wall. Require a correct causal explanation even if numeric fields are correct; never reveal hidden transfer answers in hints. Model judges reasoning; code checks values.`,
};
