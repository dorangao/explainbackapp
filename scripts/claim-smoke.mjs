// Opt-in live check: at most six requests, synthetic examples only, no retries.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { callMeta, DEFAULT_META_MODEL } from '../src/meta.mjs';
import { createClaimSession, assessClaim, advanceClaim, confirmClaim, replayClaimEvidence } from '../src/claim-testing.mjs';
import { problemPart } from '../src/problems.mjs';
const results=[];
let calls=0;
const modelCall=args=>{if(++calls>6)throw new Error('Live smoke budget exceeded.');return callMeta({...args,apiKey:process.env.MODEL_API_KEY,model:process.env.META_MODEL||DEFAULT_META_MODEL});};
async function turn(s,label,explanation,expectedAction,answer){
 const started=Date.now();s.attempts++;
 const d=await assessClaim(s,explanation,modelCall,answer);
 assert.equal(d.action,expectedAction);
 advanceClaim(s,explanation,d,answer);
 results.push({label,action:d.action,assessment:d.assessment,model:d.model,latencyMs:Date.now()-started,pass:true});
 console.log(`PASS ${label}: ${d.action}`);
}
try{
 for(const [language,explanation] of [['en','It can never touch the asymptote.'],['zh','曲线永远碰不到渐近线。']]){
  const s=createClaimSession(language);await turn(s,`${language}-ambiguous`,explanation,'ask_clarification');assert.equal(s.claim,null);
 }
 const s=createClaimSession('en');
 await turn(s,'already-correct-claim','For this function f(0)=0, and it crosses y=0 at finite x=0 because x changes sign and the denominator stays positive. This is consistent with both end limits being 0.','propose_claim');
 confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});
 await turn(s,'prediction-and-execution','I predict equality at x=0 and a change from below to above y=0, since the numerator changes sign and the denominator is positive.','run_experiment');
 assert.equal(replayClaimEvidence(s,s.evidenceRecords[0].id).verified,true);
 await turn(s,'evidence-to-transfer','The checked sign identity confirms finite crossing at x=0, while the remainder tends to zero at both ends. A finite crossing and an end limit are compatible.','select_transfer');
 const part=problemPart('crossing',s.transferId),L=part.asymptote,r=part.crossings[0];
 await turn(s,'independent-transfer',`The horizontal asymptote is y=${L}. At finite x=${r} the remainder is zero and changes sign because its denominator is always positive. The remainder tends to 0 at both ends, so crossing at this finite input is consistent with both end limits ${L}.`,'compare_reasoning',{asymptote:L,crossingX:r});
 assert.equal(s.report.outcome,'independent');assert.equal(s.report.reasoningAssessment,'model-supported');
}catch{
 // Never print raw transport errors, credentials or upstream bodies.
 results.push({label:'live-smoke-failure',pass:false,error:'Request, native action, validation, or expected progression failed. No automatic retry.'});
 console.log('FAIL: live claim workflow smoke did not complete.');process.exitCode=1;
}finally{
 await writeFile(new URL('../docs/claim-smoke-results.json',import.meta.url),JSON.stringify({syntheticExamplesOnly:true,scriptedInputs:true,independentHumanReview:false,model:process.env.META_MODEL||DEFAULT_META_MODEL,evaluatedAt:new Date().toISOString(),calls,maxCalls:6,results},null,2)+'\n');
}
