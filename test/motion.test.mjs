import assert from 'node:assert/strict';
import {test} from 'node:test';
import { motionAt, motionScenario, motionFormula, motionSummary } from '../public/motion.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('60 mph conversion, equal average acceleration, unequal derivatives and areas',()=>{
 const s=motionScenario({speedMph:60,duration:1,profileB:'rising'}),m=motionSummary(s);
 near(s.V,26.8224);near(m.averageAcceleration,26.8224);
 near(motionAt(s,'uniform',.25).acceleration,26.8224);
 near(motionAt(s,'rising',.25).acceleration,13.4112);
 near(m.distanceA,13.4112);near(m.distanceB,8.9408);near(m.distanceDifference,-4.4704);
 near(motionAt(s,'rising',0).velocity,0);near(motionAt(s,'rising',1).velocity,s.V);
});
test('falling profile has positive signed area difference and continuous endpoints',()=>{
 const s=motionScenario({speedMph:30,duration:2,profileB:'falling'}),m=motionSummary(s);
 near(m.distanceA,s.V*s.T/2);near(m.distanceB,2*s.V*s.T/3);
 near(motionAt(s,'falling',s.T).acceleration,0);
 near(motionAt(s,'falling',0).acceleration,2*s.V/s.T);
 assert.ok(m.distanceDifference>0);
});
test('transfer uses new SI-convertible contexts and answers distinct from the primary',()=>{
 const a=motionScenario({},'default'),b=motionScenario({},'alternate');
 near(a.V,10);assert.equal(a.T,5);near(motionSummary(a).averageAcceleration,2);
 near(motionSummary(a).distanceDifference,25/3);
 near(b.V,20);assert.equal(b.T,4);near(motionSummary(b).distanceDifference,-40/3);
 assert.deepEqual(motionFormula(a.id),a);
});
test('finite model refuses negative/beyond-interval time, arbitrary formulas and invalid settings',()=>{
 const s=motionScenario();
 for(const time of [-.1,s.T+.1,NaN,Infinity])assert.throws(()=>motionAt(s,'uniform',time));
 assert.throws(()=>motionAt(s,'arbitrary',0));
 for(const options of [{speedMph:0},{speedMph:'60'},{duration:0},{duration:Infinity},{profileB:'arbitrary'},{extra:1}])assert.throws(()=>motionScenario(options));
 assert.throws(()=>motionFormula('motion-60-1-run-code'));
 assert.throws(()=>motionScenario({},'unknown'));
});
test('doubling duration halves acceleration and doubles distance for fixed final speed',()=>{
 const a=motionScenario({speedMph:60,duration:1,profileB:'rising'}),b=motionScenario({speedMph:60,duration:2,profileB:'rising'});
 near(motionSummary(b).averageAcceleration,motionSummary(a).averageAcceleration/2);
 near(motionSummary(b).distanceA,2*motionSummary(a).distanceA);
});
