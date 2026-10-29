import test from 'node:test';
import assert from 'node:assert/strict';
const q=await import('../public/quantum.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const final=config=>{assert.equal(typeof q.quantumCircuit,'function');return q.quantumCircuit(config).frames.at(-1);};
test('H creates normalized amplitudes; measurement yields one bit and repeated measurement preserves it',()=>{
 const f=final({lesson:'qubit'});near(f.probabilities[0],.5);near(f.probabilities[1],.5);
 const a=q.measureQuantum(f.state,()=>.1),b=q.measureQuantum(f.state,()=>.9);
 assert.equal(a.outcome,0);assert.equal(b.outcome,1);assert.equal(q.measureQuantum(a.state,()=>.99).outcome,0);
 assert.equal(q.measureQuantum(b.state,()=>0).outcome,1);
});
test('relative phase changes interference, even with identical pre-recombination probabilities',()=>{
 for(const phase of [0,Math.PI/2,Math.PI]){
  const f=final({lesson:'interference',phase});near(f.probabilities[0],Math.cos(phase/2)**2);near(f.probabilities[1],Math.sin(phase/2)**2);
  const before=q.quantumCircuit({lesson:'interference',phase}).frames.at(-2);before.probabilities.forEach(p=>near(p,.5));
 }
});
test('Bell correlations agree in Z and X while a classical correlated mixture differs in X',()=>{
 for(const basis of ['Z','X']){const f=final({lesson:'entanglement',basis});[.5,0,0,.5].forEach((v,i)=>near(f.probabilities[i],v));
  (basis==='Z'?[.5,0,0,.5]:[.25,.25,.25,.25]).forEach((v,i)=>near(f.reference[i],v));}
});
test('one Grover iteration amplifies each possible single marked item; oracle alone changes no probability',()=>{
 for(let target=0;target<4;target++){
  const f=final({lesson:'search',target});f.probabilities.forEach((p,i)=>near(p,i===target?1:0));
  q.quantumCircuit({lesson:'search',target}).frames.at(-2).probabilities.forEach(p=>near(p,.25));
 }
});
test('sampling re-prepares the circuit each shot and rejects malformed states and configuration',()=>{
 const f=final({lesson:'qubit'});let i=0;assert.deepEqual(q.sampleQuantum(f.state,4,()=>i++%2?.9:.1),[2,2]);
 for(const config of [{lesson:'bad'},{lesson:'search',target:5},{lesson:'qubit',extra:true},{lesson:'interference',phase:Infinity},{lesson:'entanglement',basis:'Y'}])assert.throws(()=>q.quantumCircuit(config));
 for(const state of [[],[[1,0],[1,0]],[[NaN,0],[0,0]]])assert.throws(()=>q.measureQuantum(state,()=>.5));
 assert.throws(()=>q.sampleQuantum(f.state,0));assert.throws(()=>q.measureQuantum(f.state,()=>1));
});
