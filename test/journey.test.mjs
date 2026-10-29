import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journeyScenario,journeyAt} from '../public/journey.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('journey preserves position and horizontal speed across both model boundaries',()=>{
 const s=journeyScenario({duration:5,profileB:'smooth'},{airtime:2,stopTime:.3});
 const launch=journeyAt(s,5),before=journeyAt(s,5-1e-9),touch=journeyAt(s,7);
 near(launch.x,67.056);near(before.x,launch.x);near(launch.vx,26.8224);
 near(launch.vy,9.80665);near(before.vy,0);assert.equal(launch.phase,'flight');
 near(touch.x,120.7008);near(touch.y,0);near(touch.vy,-9.80665);
 near(journeyAt(s,7-1e-9).x,touch.x);assert.equal(touch.phase,'contact');
 near(journeyAt(s,7.3).vx,26.8224);near(journeyAt(s,7.3).vy,0);
 near(journeyAt(s,7.3).y,-1.4709975);
});
test('journey exposes rotation only in flight, never invented contact torque',()=>{
 const s=journeyScenario({duration:5,profileB:'smooth'},{airtime:2});
 near(journeyAt(s,5.5).torque,15988.75912976476);
 near(journeyAt(s,6).angle,Math.PI);
 assert.equal(journeyAt(s,7.1).omega,null);assert.equal(journeyAt(s,7.1).torque,null);
 near(journeyAt(s,7.15).contactForce,150368.63333333333);
});
test('journey rejects mismatched mass, altered settings and out of range times',()=>{
 assert.throws(()=>journeyScenario({massKg:1200},{massKg:2000}));
 const s=journeyScenario();for(const t of [-1,NaN,Infinity,s.end+.1])assert.throws(()=>journeyAt(s,t));
 assert.throws(()=>journeyAt({...s,end:100},4));
});
