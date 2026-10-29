import assert from 'node:assert/strict';
import {test} from 'node:test';
import {flightScenario,flightFormula,rotationAt,contactAt,flightAt,flightSummary} from '../public/flight.mjs';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
test('ballistic flight uses the same height at launch and touchdown, not a free independent impact speed',()=>{
 const s=flightScenario({airtime:2});
 near(flightAt(s,0).height,0);near(flightAt(s,1).height,4.903325);near(flightAt(s,2).height,0);
 near(flightAt(s,0).verticalVelocity,9.80665);near(flightAt(s,1).verticalVelocity,0);near(flightAt(s,2).verticalVelocity,-9.80665);
});
test('both rotations end upright but torque-free A retains angular speed and energy',()=>{
 const s=flightScenario({airtime:2,massKg:2000,radius:1.2}),r=flightSummary(s);
 near(rotationAt(s,'coast',2).angle,2*Math.PI);near(rotationAt(s,'controlled',2).angle,2*Math.PI);
 near(rotationAt(s,'coast',2).omega,Math.PI);near(rotationAt(s,'controlled',2).omega,0);
 near(rotationAt(s,'controlled',0).omega,0);near(rotationAt(s,'coast',1).torque,0);
 assert.ok(r.residualEnergyA>0);near(r.residualEnergyB,0);
});
test('controlled torque changes sign, scales with inertia, and a pure couple has two forces',()=>{
 const s=flightScenario({airtime:2,massKg:2000,radius:1.2,separation:.5});
 const a=rotationAt(s,'controlled',.5),b=rotationAt(s,'controlled',1.5);
 near(a.alpha,Math.PI**2);near(a.torque,2880*Math.PI**2);near(b.torque,-a.torque);
 near(a.coupleForce,5760*Math.PI**2);near(flightSummary(s).netAngularImpulseB,0);
 const heavier=flightSummary(flightScenario({massKg:2800})),base=flightSummary(flightScenario());
 near(heavier.peakTorque,base.peakTorque*1.4);
 const longer=flightSummary(flightScenario({airtime:2})),shorter=flightSummary(flightScenario({airtime:1}));
 near(longer.peakTorque,shorter.peakTorque/4);
});
test('contact force includes weight and equal impulse can hide double dynamic peak load',()=>{
 const constant=flightScenario({airtime:2,massKg:2000,stopTime:.3,landingProfile:'constant'});
 const pulse=flightScenario({airtime:2,massKg:2000,stopTime:.3,landingProfile:'pulse'});
 const a=flightSummary(constant),b=flightSummary(pulse);
 near(a.netLandingImpulse,19613.3);near(a.contactImpulse,25497.29);
 near(a.averageContactForce,84990.96666666667);near(b.averageContactForce,a.averageContactForce);
 near(b.peakContactForce,150368.63333333333);near(a.peakContactForce,a.averageContactForce);
 near(contactAt(pulse,.15).contactForce,b.peakContactForce);
 near(contactAt(pulse,0).contactForce,19613.3);
});
test('both stopping profiles end at zero vertical speed with equal travel; longer stops lower force but need travel',()=>{
 for(const landingProfile of ['constant','pulse']){
  const s=flightScenario({airtime:2,stopTime:.6,landingProfile});
  near(contactAt(s,0).verticalVelocity,-9.80665);near(contactAt(s,.6).verticalVelocity,0);
  near(contactAt(s,.6).height,-2.941995);near(flightSummary(s).stoppingTravel,2.941995);
 }
 const a=flightSummary(flightScenario({stopTime:.15})),b=flightSummary(flightScenario({stopTime:.3}));
 near(a.averageContactForce-a.weight,2*(b.averageContactForce-b.weight));
});
test('contact impulse numerically agrees with the analytic result for both force profiles',()=>{
 for(const landingProfile of ['constant','pulse']){
  const s=flightScenario({landingProfile}),n=1000,dt=s.stopTime/n;
  let impulse=0;
  for(let i=0;i<n;i++)impulse+=contactAt(s,(i+.5)*dt).contactForce*dt;
  near(impulse,flightSummary(s).contactImpulse,1e-6);
 }
});
test('catalog binds all settings and rejects malformed inputs and rotation beyond touchdown',()=>{
 const s=flightScenario();assert.deepEqual(flightFormula(s.id),s);
 for(const config of [null,[],{airtime:0},{massKg:'2000'},{radius:Infinity},{separation:0},{stopTime:0},{landingProfile:'eval'},{other:1}])assert.throws(()=>flightScenario(config));
 for(const t of [-.1,NaN,Infinity,s.airtime+s.stopTime+.01])assert.throws(()=>flightAt(s,t));
 assert.throws(()=>rotationAt(s,'controlled',s.airtime+.01));assert.throws(()=>rotationAt(s,'unknown',0));
 assert.throws(()=>contactAt(s,-.1));assert.throws(()=>flightSummary({...s,massKg:1}));
 assert.notEqual(flightScenario({stopTime:.6}).id,s.id);
});
test('fresh transfer ignores primary settings and has independent mass, timing and inertia',()=>{
 const a=flightScenario({},'default'),b=flightScenario({massKg:2800,airtime:2},'default');
 assert.deepEqual(a,b);assert.equal(a.massKg,1500);assert.equal(a.airtime,1.2);assert.equal(a.radius,.8);
 near(flightSummary(a).impactSpeed,5.88399);near(flightSummary(a).averageContactForce,58839.9);
});
