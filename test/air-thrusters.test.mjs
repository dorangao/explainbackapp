import test from 'node:test';import assert from 'node:assert/strict';
import * as flight from '../public/flight.mjs';
const {flightScenario,rotationAt,airThrustersAt}=flight;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('opposing jets produce the checked roll torque with zero resultant force',()=>{
 assert.equal(typeof airThrustersAt,'function','jet model is available');
 for(const separation of [.5,1,1.5])for(const u of [.1,.25,.4,.6,.75,.9]){
  const s=flightScenario({separation}),r=rotationAt(s,'controlled',u*s.airtime),jets=airThrustersAt(s,'controlled',u*s.airtime);
  near(jets.forceEach,Math.abs(r.torque)/separation);assert.equal(jets.ports.length,2);
  const sum=[0,0,0];let rollTorque=0;
  for(const p of jets.ports){p.force.forEach((v,i)=>sum[i]+=v);rollTorque+=p.position[1]*p.force[2]-p.position[2]*p.force[1];
   near(p.exhaustDirection.reduce((v,x,i)=>v+x*p.force[i],0),-jets.forceEach);
  }
  sum.forEach(v=>near(v,0));near(rollTorque,r.torque);
 }
});
test('jets reverse to brake and turn off at zero torque, during coasting and contact',()=>{
 assert.equal(typeof airThrustersAt,'function','jet model is available');
 const s=flightScenario(),a=airThrustersAt(s,'controlled',s.airtime/4),b=airThrustersAt(s,'controlled',3*s.airtime/4);
 assert.equal(a.phase,'spin-up');assert.equal(b.phase,'spin-down');assert.ok(a.ports[0].bodyDirection===-b.ports[0].bodyDirection);
 for(const t of [0,s.airtime/2,s.airtime])assert.equal(airThrustersAt(s,'controlled',t).active,false);
 assert.equal(airThrustersAt(s,'coast',s.airtime/4).active,false);
 assert.equal(airThrustersAt(s,'controlled',s.airtime,false).active,false);
 assert.throws(()=>airThrustersAt(s,'controlled',NaN));
});

// A lateral point must move into z, while a nose/tail point stays on x.
// This guards against replacing a barrel roll with an end-over-end SVG rotation.
test('vehicle projection rolls about the longitudinal axis without pitching the nose',async()=>{
 const {rollPoint}=await import('../public/roll-view.mjs');
 for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2,2*Math.PI]){
  const nose=rollPoint([38,0,0],angle);near(nose[0],38);near(nose[1],0);near(nose[2],0);
  const side=rollPoint([3,21,7],angle);near(side[0],3);near(side[1]**2+side[2]**2,21**2+7**2);
 }
 const quarter=rollPoint([0,1,0],Math.PI/2);near(quarter[1],0);near(quarter[2],1);
});
