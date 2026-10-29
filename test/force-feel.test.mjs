import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as model from '../public/motion.mjs';
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('cosine pulse joins rest and cruise with zero acceleration and jerk, but doubles peak acceleration',()=>{
 const s=model.motionScenario({profileB:'smooth',duration:2});
 for(const t of [0,2]){const p=model.motionAt(s,'smooth',t);near(p.acceleration,0);near(p.jerk,0);}
 const mid=model.motionAt(s,'smooth',1);
 near(mid.velocity,13.4112);near(mid.acceleration,26.8224);
 near(model.motionAt(s,'smooth',2).distance,26.8224);
 near(model.motionSummary(s).distanceDifference,0);
 near(model.motionAt(s,'smooth',.5).jerk,42.13252739582343);
});
test('force and wheel power use SI mass; weight is a distinct force and both practical limits can fail',()=>{
 const s=model.motionScenario(),p=model.physicsAt(s,'uniform',1),r=model.physicsSummary(s,'uniform');
 near(p.force,53644.8);near(p.powerKw,1438.88228352);near(r.weight,19613.3);
 near(r.tractionForce,19613.3);near(r.peakForce,53644.8);
 assert.equal(r.tractionOK,false);assert.equal(r.powerOK,false);assert.equal(r.withinLimits,false);
 assert.equal(r.endpointJumps,true);near(r.peakJerk,0);
});
test('more mass increases demand while ideal traction acceleration limit is mass independent',()=>{
 const a=model.motionScenario({massKg:2000}),b=model.motionScenario({massKg:2800});
 const x=model.physicsSummary(a,'rising'),y=model.physicsSummary(b,'rising');
 near(y.peakForce,1.4*x.peakForce);near(y.peakPowerKw,1.4*x.peakPowerKw);
 near(y.gripRequired,x.gripRequired);near(y.tractionForce,1.4*x.tractionForce);
 assert.notEqual(a.id,b.id);assert.deepEqual(model.motionFormula(b.id),b);
});
test('peak power is checked over the full profile, including internal maxima',()=>{
 const s=model.motionScenario({profileB:'smooth',duration:8});
 const smooth=model.physicsSummary(s,'smooth'),falling=model.physicsSummary(s,'falling');
 assert.ok(smooth.peakPowerTime>4&&smooth.peakPowerTime<6);
 near(model.physicsAt(s,'smooth',8).powerKw,0);assert.ok(smooth.peakPowerKw>0);
 near(falling.peakPowerTime,3.3811978464829933);
 assert.equal(smooth.withinLimits,true);assert.equal(smooth.endpointJumps,false);
 for(const profile of ['uniform','rising','falling','smooth']){
  const r=model.physicsSummary(s,profile);
  for(let i=0;i<=1000;i++)assert.ok(model.physicsAt(s,profile,s.T*i/1000).powerKw<=r.peakPowerKw+1e-8);
 }
});
test('doubling time halves force/power, quarters jerk; limit time applies to the selected shape',()=>{
 const a=model.physicsSummary(model.motionScenario({profileB:'smooth',duration:1}),'smooth');
 const b=model.physicsSummary(model.motionScenario({profileB:'smooth',duration:2}),'smooth');
 near(b.peakForce,a.peakForce/2);near(b.peakPowerKw,a.peakPowerKw/2);near(b.peakJerk,a.peakJerk/4);
 near(a.minimumDuration,b.minimumDuration);
 assert.ok(a.minimumDuration>5&&a.minimumDuration<8);
});
test('invalid physics settings and changed scenario parameters are rejected before computation',()=>{
 for(const config of [{massKg:0},{massKg:'2000'},{grip:NaN},{grip:-1},{powerKw:Infinity},{powerKw:0}])assert.throws(()=>model.motionScenario(config));
 const s=model.motionScenario();
 for(const key of ['massKg','grip','powerKw'])assert.throws(()=>model.physicsSummary({...s,[key]:-1},'uniform'));
 assert.throws(()=>model.physicsAt(s,'smooth',-1));
});
