import test from 'node:test';
import assert from 'node:assert/strict';
import {suctionScenario,orientationAt,leakageAt,pressureBound,designComparison,robotResult,aeroForce,suctionFormula} from '../public/suction.mjs';
const near=(a,b,t=.01)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('static normal and tangential force balance has a 135 degree counterexample',()=>{
 const s=suctionScenario();
 for(const [angle,n,t,pass] of [[0,43613.3,0,true],[90,24000,19613.3,true],[135,10131.30257,13868.69743,false],[180,4386.7,0,true]]){
  const r=orientationAt(s,angle);near(r.normalN,n);near(r.tangentialGravityN,t);assert.equal(r.equilibriumPossible,pass);
 }
 near(orientationAt(s,135).allAngleForceN,27737.39486);
 const low=orientationAt(suctionScenario({pressurePa:3000}),180);
 assert.equal(low.contactPossible,false);assert.equal(low.frictionCapacityN,0);assert.equal(low.equilibriumPossible,false);
});
test('leakage scales with gap and pressure to 3/2; budget bound is not a fan curve',()=>{
 const s=suctionScenario();
 near(leakageAt(s,6000,5).powerKw,25.7333333);near(leakageAt(s,6000,10).powerKw,51.4666667);
 near(leakageAt(s,6000,2.5).powerKw,12.8666667);near(pressureBound(s,30,10),4186.792264);
 near(pressureBound(s,60,10)/pressureBound(s,30,10),2**(2/3),1e-9);
 assert.equal(pressureBound(s,0,10),0);assert.equal(leakageAt(s,0,5).flowM3s,0);
 assert.throws(()=>leakageAt(s,6000,0));assert.throws(()=>leakageAt(s,12000,5));
 assert.throws(()=>pressureBound(s,NaN,5));assert.throws(()=>orientationAt(s,181));
 assert.equal(aeroForce(0),0);near(aeroForce(20)/aeroForce(10),4,1e-9);
});
test('design screening retains the power constraint and explicit unvalidated status',()=>{
 const r=designComparison(suctionScenario());assert.equal(r.budgetKw,30);
 const by=Object.fromEntries(r.candidates.map(c=>[c.id,c]));
 near(by.original.worstForceN,16747.169);near(by['double-power'].worstForceN,26584.48);
 assert.equal(by['double-power'].withinBudget,false);assert.equal(by['double-power'].meetsScreen,false);
 assert.equal(by['reduce-leakage'].meetsScreen,true);assert.equal(by['reduce-mass'].meetsScreen,false);
 assert.equal(r.validationStatus,'unvalidated_model_only');
});
test('fresh wall robot needs friction, not just ceiling force',()=>{
 const r=robotResult(suctionScenario({},'default'));near(r.minPressurePa,2451.6625);near(r.frictionAtPressureN,16);assert.equal(r.equilibriumPossible,false);
 const alt=robotResult(suctionScenario({},'alternate'));assert.notEqual(alt.minPressurePa,r.minPressurePa);
});
test('scenario catalog rejects numeric strings, unknown variants and tampered evidence inputs',()=>{
 assert.throws(()=>suctionScenario({massKg:'2000'}));assert.throws(()=>suctionScenario({other:1}));assert.throws(()=>suctionScenario({},'invented'));
 const s=suctionScenario();assert.deepEqual(suctionFormula(s.id),s);assert.throws(()=>orientationAt({...s,massKg:1},90));
});
