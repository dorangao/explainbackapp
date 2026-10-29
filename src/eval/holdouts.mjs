// Additional wording and negative controls, separate from the original eight-case comparison.
import {createSession} from '../learning.mjs';import {evaluationCases} from './cases.mjs';
function claim(problem,language){const s=createSession(problem,language,'claim-testing');s.evidenceSessionId='holdout-session';s.createdAt=0;return s;}
export function refinementHoldouts(){
 const transfer=evaluationCases().find(c=>c.id==='torque-transfer-en'),revision=evaluationCases().find(c=>c.id==='torque-revision-zh');
 return [
  {id:'mass-force-false-en',language:'en',session:claim('acceleration','en'),text:'In this ideal level-road model, doubling the mass while keeping the same acceleration curve halves the required driving force.',expected:{action:'propose_claim',assessment:'misconception',kind:'force-feasibility',phase:'confirm'}},
  {id:'crossing-supported-zh',language:'zh',session:claim('crossing','zh'),text:'在有限输入处，函数图像可以穿过水平渐近线，同时保持无穷远处的极限；有限处和无穷远描述的是不同性质。',expected:{action:'propose_claim',assessment:'supported',kind:'finite-crossing',phase:'confirm'}},
  {id:'help-without-claim-zh',language:'zh',session:claim('flight','zh'),text:'我不理解这些图，可以先解释要检验什么吗？',expected:{action:'ask_clarification',assessment:'ambiguous',phase:'claim'}},
  {...transfer,id:'sound-reasoning-wrong-value-en',answer:{peakTorque:0,touchdownOmegaA:5.24},expected:{phase:'transfer'}},
  {...revision,id:'vague-revision-zh',text:'好的，我同意。',expected:{action:'ask_clarification',assessment:'ambiguous',phase:'revision'}},
  {...revision,id:'incorrect-revision-zh',text:'净角冲量为零，所以我仍然认为每一时刻的力矩必定为零，实验里的非零力矩曲线一定是错的。',expected:{action:'ask_clarification',assessment:'ambiguous',phase:'revision'}},
 ];
}
