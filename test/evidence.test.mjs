import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeExperiment, replayEvidence } from '../src/evidence.mjs';

const input = { sessionId:'session-a',claimId:'claim-a',formulaId:'crossing-primary',experimentId:'finite-crossing',evidenceId:'ev-a' };
test('fixed crossing proof distinguishes equality, sign change, and end limits',()=>{
  const e=executeExperiment(input);
  assert.equal(e.result.intersection.x,0);
  assert.equal(e.result.intersection.y,0);
  assert.equal(e.result.crosses,true);
  assert.equal(e.result.leftSign,-1);
  assert.equal(e.result.rightSign,1);
  assert.deepEqual(e.result.endLimits,{left:0,right:0});
  assert.equal(e.method,'fixed-catalog-algebra-v1');
  assert.match(e.limitations.en,/not.*learner|learner.*not/i);
  assert.equal(replayEvidence(e,input).verified,true);
});
test('all fixed crossing variants have checked witnesses away from and at the origin',()=>{
  for(const [formulaId,x,y] of [['crossing-primary',0,0],['crossing-transfer',3,2],['crossing-alternate',-2,-1]]){
    const e=executeExperiment({...input,formulaId});
    assert.deepEqual(e.result.intersection,{x,y});
    assert.equal(e.result.leftSign,-1);assert.equal(e.result.rightSign,1);
    assert.match(e.proof.en,/positive/);
  }
});
test('equality and end behavior experiments qualify their conclusions separately',()=>{
  const equality=executeExperiment({...input,experimentId:'finite-equality'});
  assert.equal(equality.result.crosses,undefined);
  const ends=executeExperiment({...input,experimentId:'end-behavior'});
  assert.equal(ends.result.intersection,undefined);
  assert.match(ends.proof.en,/1\/x/);
});
test('replay rejects forged results and wrong session, claim, formula, or experiment',()=>{
  const e=executeExperiment(input);
  for(const change of [{sessionId:'other'},{claimId:'other'},{formulaId:'crossing-transfer'},{experimentId:'end-behavior'}])
    assert.throws(()=>replayEvidence(e,{...input,...change}));
  const forged=structuredClone(e);forged.result.intersection.y=42;
  assert.throws(()=>replayEvidence(forged,input));
  for(const change of [{formulaId:'nonzero-primary'},{formulaId:'__proto__'},{experimentId:'run-code'}])
    assert.throws(()=>executeExperiment({...input,...change}));
});

test('motion evidence uses SI derivatives/integrals and rejects altered scenario context',()=>{
 const context={...input,formulaId:'motion-60-1-rising',experimentId:'motion-acceleration'};
 const e=executeExperiment(context);
 assert.equal(e.result.averageAcceleration,26.8224);
 assert.ok(Math.abs(e.result.distanceDifference+4.4704)<1e-9);
 assert.match(e.limitations.en,/hypothetical|Hypothetical/);
 assert.equal(replayEvidence(e,context).verified,true);
 const forged=structuredClone(e);forged.inputs.T=2;assert.throws(()=>replayEvidence(forged,context));
 assert.throws(()=>executeExperiment({...context,experimentId:'finite-crossing'}));
 assert.throws(()=>replayEvidence(e,{...context,formulaId:'motion-60-2-rising'}));
});
