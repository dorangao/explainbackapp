import {suctionFormula,suctionConstants,suctionSummary,designComparison,robotResult,suctionAssumptions} from '../public/suction.mjs';
const pair=(en,zh)=>({en,zh});
export function executeSuctionExperiment({sessionId,claimId,formulaId,experimentId,evidenceId}){
 if(![sessionId,claimId,evidenceId].every(v=>typeof v==='string'&&v.length>0&&v.length<=160)||!['suction-static','suction-orientation','suction-leakage','suction-design'].includes(experimentId))throw new Error('Unsupported suction evidence.');
 const s=suctionFormula(formulaId),transfer=formulaId.startsWith('suction-transfer-');
 if(transfer&&experimentId==='suction-design')throw new Error('Design comparison is primary only.');
 const result=transfer?robotResult(s):experimentId==='suction-design'?designComparison(s):suctionSummary(s);
 const proof=pair('Static contact: N=ΔpA+mg cosθ≥0; μN≥mg|sinθ|. Leakage: Q=Cd Lh√(2Δp/ρ); P=ΔpQ/η_total. Invert the power equation for an optimistic pressure bound. At a vertical wall, Δp_min=mg/(μA). All values are deterministic analytic results for the pinned inputs.',
 '静态接触：N=ΔpA+mg cosθ≥0；μN≥mg|sinθ|。泄漏：Q=Cd Lh√(2Δp/ρ)，P=ΔpQ/η_total。反解功率方程得到乐观压差上界。竖直墙面 Δp_min=mg/(μA)。数值由固定参数和解析方程确定。');
 let conclusion=pair('Ceiling support and grip at every angle are different tests. Check the normal and friction conditions separately. Doubling the effective gap doubles required power at fixed pressure. The computed pressure bound is not a measured fan capability.',
 '天花板支撑与每个角度的抓附是不同检验。分别检查法向力与摩擦条件。固定压差时，有效间隙翻倍使所需功率翻倍。计算压差上界不等于实测风机能力。');
 if(experimentId==='suction-design')conclusion=pair('Screen each candidate against BOTH the 30 kW budget and ΔpA≥1.2mg at doubled gap. A passing row is an untested design hypothesis. The 20% reserve is a teaching target, not a safety factor or an all-angle result.',
 '每种方案必须同时满足 30 kW 预算，以及间隙翻倍时 ΔpA≥1.2mg。通过行仅表示未经验证的设计假设。20% 余量是教学目标，不是安全系数，也不是全角度结论。');
 if(transfer)conclusion=pair('On a vertical wall, suction creates normal force; friction supports weight. Compare μΔpA with mg, not just ΔpA with mg.',
 '竖直墙面上，吸附产生法向力，摩擦支撑重量。应比较 μΔpA 与 mg，而不只是 ΔpA 与 mg。');
 return {version:1,id:evidenceId,sessionId,claimId,formulaId,formulaVersion:1,experimentId,method:'sealed-static-leakage-v1',inputs:{...s,constants:{...suctionConstants}},result,proof,conclusion,limitations:suctionAssumptions};
}
