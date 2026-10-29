import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as journey from '../public/journey.mjs';
import {flightGravity as g,rotationAt} from '../public/flight.mjs';
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
// These assertions reject an instantaneous launch, impact stopping, or a hidden forward thrust.
test('powered journey has continuous position and velocity across every phase',()=>{
 assert.equal(typeof journey.poweredJourneyScenario,'function');
 const s=journey.poweredJourneyScenario({duration:5});
 for(const t of [s.launch,s.rollStart,s.landing,s.touchdown]){
  const before=journey.poweredJourneyAt(s,t-1e-9),at=journey.poweredJourneyAt(s,t);
  for(const k of ['x','y','vx','vy','angle','omega'])near(before[k],at[k]);
 }
 const start=journey.poweredJourneyAt(s,0),end=journey.poweredJourneyAt(s,s.touchdown);
 near(start.y,0);near(start.vy,0);near(end.y,0);near(end.vy,0);near(end.angle,2*Math.PI);near(end.omega,0);
});
test('powered lift and landing balance weight; roll is a zero-net-force couple',()=>{
 const s=journey.poweredJourneyScenario({duration:5});
 for(const t of [s.launch+.1,s.landing+.1]){
  const p=journey.poweredJourneyAt(s,t);near(p.thrust,2*s.motion.massKg*g);near(p.ay,g);near(p.contactForce,0);
  near(p.jets.ports.reduce((v,j)=>v+j.force[2],0),p.thrust);
  near(p.thrust+p.contactForce-s.motion.massKg*g,s.motion.massKg*p.ay);
 }
 const p=journey.poweredJourneyAt(s,s.rollStart+s.flight.airtime/4),r=rotationAt(s.flight,'controlled',s.flight.airtime/4);
 near(p.torque,r.torque);near(p.ay,-g);near(p.thrust,0);
 for(let i=0;i<3;i++)near(p.jets.ports.reduce((v,j)=>v+j.force[i],0),0);
 near(journey.poweredJourneyAt(s,s.end).contactForce,s.motion.massKg*g);
});
test('forward inertia is independent of roll and mass scales forces only',()=>{
 const a=journey.poweredJourneyScenario({massKg:1200},{massKg:1200}),b=journey.poweredJourneyScenario({massKg:2800},{massKg:2800});
 for(const s of [a,b]){const p=journey.poweredJourneyAt(s,s.launch),q=journey.poweredJourneyAt(s,s.end);near(q.x-p.x,s.motion.V*(s.end-s.launch));near(q.vx,p.vx);}
 const p=journey.poweredJourneyAt(a,a.launch+.1),q=journey.poweredJourneyAt(b,b.launch+.1);near(p.y,q.y);near(q.thrust/p.thrust,2800/1200);
});
test('powered journey rejects changed boundaries and invalid time',()=>{
 const s=journey.poweredJourneyScenario();
 for(const t of [-1,NaN,Infinity,s.end+.01])assert.throws(()=>journey.poweredJourneyAt(s,t));
 assert.throws(()=>journey.poweredJourneyAt({...s,landing:100},0));
 assert.throws(()=>journey.poweredJourneyScenario({massKg:1200},{massKg:2000}));
});
