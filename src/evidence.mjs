import {executeSuctionExperiment} from './suction-evidence.mjs';
import {executeFlightExperiment} from './flight-evidence.mjs';
import { isDeepStrictEqual } from 'node:util';
import { evaluate } from './problems.mjs';
import { executeMotionExperiment } from './motion-evidence.mjs';

// Closed catalog: h(x)=L+(x-r)/(x²+1). These facts are not inferred by a model.
const catalog = new Map([
  ['crossing-primary',{L:0,r:0}],
  ['crossing-transfer',{L:2,r:3}],
  ['crossing-alternate',{L:-1,r:-2}],
]);
export const experimentIds = ['finite-equality','finite-crossing','end-behavior'];
const pair=(en,zh)=>({en,zh});
export function executeExperiment({sessionId,claimId,formulaId,experimentId,evidenceId}) {
  if(typeof formulaId==='string'&&formulaId.startsWith('suction-'))return executeSuctionExperiment({sessionId,claimId,formulaId,experimentId,evidenceId});
  if(typeof formulaId==='string'&&formulaId.startsWith('flight-'))return executeFlightExperiment({sessionId,claimId,formulaId,experimentId,evidenceId});
  if(typeof formulaId==='string'&&formulaId.startsWith('motion-'))return executeMotionExperiment({sessionId,claimId,formulaId,experimentId,evidenceId});
  if(![sessionId,claimId,evidenceId].every(v=>typeof v==='string'&&v.length>0&&v.length<=160)
    ||!catalog.has(formulaId)||!experimentIds.includes(experimentId)) throw new Error('Unsupported evidence context.');
  const {L,r}=catalog.get(formulaId);
  // Check that the executable catalog and the exact identity still agree.
  if(evaluate(formulaId,r)!==L) throw new Error('Catalog identity mismatch.');
  const result={};
  let proof,conclusion;
  if(experimentId==='end-behavior') {
    result.endLimits={left:L,right:L};
    proof=pair('For h(x)=L+(x-r)/(x²+1), divide the remainder by x²: (1/x-r/x²)/(1+1/x²) tends to 0 at both ends.',
      '对于 h(x)=L+(x-r)/(x²+1)，余项分子分母同除以 x²，得到 (1/x-r/x²)/(1+1/x²)，在两端都趋于零。');
    conclusion=pair(`Both end limits are ${L}. This statement concerns unbounded input, not a forbidden finite crossing.`,
      `两端极限都是 ${L}。这描述无穷远处的行为，并不禁止有限处的交点。`);
  } else {
    result.intersection={x:r,y:L};
    if(experimentId==='finite-crossing') {
      result.crosses=true;result.leftSign=-1;result.rightSign=1;result.endLimits={left:L,right:L};
      proof=pair('For h(x)-L=(x-r)/(x²+1), the denominator is strictly positive for every real x. The numerator is negative before r, zero at r, and positive after r. Division by x² establishes remainder limit 0 at both ends.',
        'h(x)-L=(x-r)/(x²+1) 的分母对任意实数 x 都严格为正。分子在 r 左侧为负、r 处为零、右侧为正。分子分母同除以 x² 可得余项两端极限为零。');
      conclusion=pair(`At x=${r}, h(x)=${L}; the sign of h(x)-${L} changes across ${r}. This is a crossing, compatible with both end limits ${L}.`,
        `当 x=${r} 时 h(x)=${L}；h(x)-(${L}) 在 ${r} 两侧变号，因此是穿越，与两端极限 ${L} 相容。`);
    } else {
      proof=pair(`Substitute x=${r}: (x-r)/(x²+1)=0 because the numerator is zero and the denominator is positive. Equality alone does not prove crossing.`,
        `代入 x=${r}，分子为零而分母为正，所以 (x-r)/(x²+1)=0。仅相等并不能证明穿越。`);
      conclusion=pair(`h(${r})=${L} is a finite intersection. This experiment alone establishes neither crossing nor an end limit.`,
        `h(${r})=${L} 说明存在有限交点。本实验单独并不证明穿越或无穷远处的极限。`);
    }
  }
  return {version:1,id:evidenceId,sessionId,claimId,formulaId,formulaVersion:1,experimentId,
    method:'fixed-catalog-algebra-v1',inputs:{L,r},result,proof,conclusion,
    limitations:pair('Only the fixed catalog identity is checked. This is not verification of the learner’s wording, understanding, or lasting mastery. A finite plot is not a proof of a limit.',
      '仅核验固定题库中的恒等式，并不证明学习者措辞、理解或长期掌握正确。有限图像不能证明极限。')};
}
export function replayEvidence(record,context) {
  const expected=executeExperiment({...context,evidenceId:record.id});
  if(!isDeepStrictEqual(record,expected)) throw new Error('Evidence integrity or context mismatch.');
  return {id:record.id,verified:true,method:expected.method,modelCalls:0};
}
