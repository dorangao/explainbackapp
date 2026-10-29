import {motionScenario,physicsAt} from './motion.mjs';
import {flightScenario,flightAt,contactAt,rotationAt} from './flight.mjs';
export {poweredJourneyScenario,poweredJourneyAt} from './powered-journey.mjs';

export function journeyScenario(motion={},flight={}) {
 const m=motionScenario({profileB:'smooth',...motion}),f=flightScenario(flight);
 if(m.massKg!==f.massKg)throw new Error('Journey models must share mass.');
 return {motion:m,flight:f,launch:m.T,touchdown:m.T+f.airtime,end:m.T+f.airtime+f.stopTime};
}
export function journeyAt(s,t) {
 const {motion:m,flight:f}=s;
 // Canonical component validation is delegated to the shared physics functions.
 const exit=physicsAt(m,m.profileB,m.T);rotationAt(f,'controlled',0);
 if(s.launch!==m.T||s.touchdown!==m.T+f.airtime||s.end!==m.T+f.airtime+f.stopTime||m.massKg!==f.massKg||!Number.isFinite(t)||t<0||t>s.end)throw new Error('Outside the journey model.');
 if(t<s.launch){const p=physicsAt(m,m.profileB,t);return {phase:'acceleration',x:p.distance,y:0,vx:p.velocity,vy:0,angle:0,omega:0,torque:0,driveForce:p.force,contactForce:null};}
 const elapsed=t-s.launch,x=exit.distance+m.V*elapsed;
 if(t<s.touchdown){const p=flightAt(f,elapsed),r=rotationAt(f,'controlled',elapsed);return {phase:'flight',x,y:p.height,vx:m.V,vy:p.verticalVelocity,angle:r.angle,omega:r.omega,torque:r.torque,driveForce:0,contactForce:0};}
 const p=contactAt(f,Math.min(f.stopTime,Math.max(0,t-s.touchdown)));
 return {phase:'contact',x,y:p.height,vx:m.V,vy:p.verticalVelocity,angle:2*Math.PI,omega:null,torque:null,driveForce:0,contactForce:p.contactForce};
}
