// Prescribed teaching trajectory. Baseline ballistic/contact models remain in journey.mjs.
import {motionScenario,physicsAt} from './motion.mjs';
import {flightScenario,rotationAt,airThrustersAt,flightGravity as g} from './flight.mjs';

export function poweredJourneyScenario(motion={},flight={}) {
 const m=motionScenario({profileB:'smooth',...motion}),f=flightScenario(flight);
 if(m.massKg!==f.massKg)throw new Error('Journey models must share mass.');
 const burn=f.airtime/2,launch=m.T,rollStart=launch+burn,landing=rollStart+f.airtime,touchdown=landing+burn;
 return {motion:m,flight:f,burn,launch,rollStart,landing,touchdown,end:touchdown+.5};
}

export function poweredJourneyAt(s,t) {
 const {motion:m,flight:f}=s,exit=physicsAt(m,m.profileB,m.T);
 rotationAt(f,'controlled',0); // Validate catalog inputs, including inertia and jet separation.
 const b=f.airtime/2;
 if(m.massKg!==f.massKg||s.burn!==b||s.launch!==m.T||s.rollStart!==m.T+b||s.landing!==m.T+b+f.airtime||s.touchdown!==s.landing+b||s.end!==s.touchdown+.5||!Number.isFinite(t)||t<0||t>s.end)throw new Error('Outside the powered journey.');
 const weight=m.massKg*g,off={active:false,ports:[],phase:'off',intensity:0,torque:0,forceEach:0};
 const p={phase:'ground',x:exit.distance+m.V*(t-s.launch),y:0,vx:m.V,vy:0,ay:0,angle:2*Math.PI,omega:0,torque:0,driveForce:0,contactForce:weight,weight,thrust:0,jets:off};
 if(t<s.launch){const a=physicsAt(m,m.profileB,t);return {...p,phase:'acceleration',x:a.distance,vx:a.velocity,angle:0,driveForce:a.force};}
 if(t>=s.touchdown)return p;
 p.contactForce=0;
 if(t<s.rollStart||t>=s.landing){
  const lift=t<s.rollStart,q=lift?t-s.launch:t-s.landing,remaining=Math.max(0,b-q);
  Object.assign(p,{phase:lift?'lift':'landing',angle:lift?0:2*Math.PI,
   y:lift?.5*g*q*q:.5*g*remaining*remaining,vy:lift?g*q:-g*remaining,ay:g,thrust:2*weight});
  p.jets={active:true,phase:lift?'lift':'landing',torque:0,forceEach:weight,intensity:.65,
   ports:[-1,1].map(side=>({side,bodyDirection:1,position:[0,side*f.separation/2,0],force:[0,0,weight],exhaustDirection:[0,0,-1]}))};
  return p;
 }
 const q=t-s.rollStart,r=rotationAt(f,'controlled',q);
 return {...p,phase:'roll',y:.5*g*b*b+g*b*q-.5*g*q*q,vy:g*(b-q),ay:-g,
  angle:r.angle,omega:r.omega,torque:r.torque,jets:airThrustersAt(f,'controlled',q)};
}
