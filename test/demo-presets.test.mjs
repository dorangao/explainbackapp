import {test} from 'node:test';import assert from 'node:assert/strict';
import {demoPresets} from '../public/demo-presets.mjs';
test('bilingual presets use fresh transfer physics, not primary settings',()=>{
 const s={phase:'transfer',problem:{id:'flight',formula:'flight-transfer-default'},claim:{kind:'landing-impulse'},answerFields:[{key:'averageContactForce'},{key:'peakContactForce'}]};
 for(const language of ['en','zh']){const p=demoPresets(s,language)[0];assert.equal(p.answer.averageContactForce,58839.9);assert.equal(p.answer.peakContactForce,58839.9);assert.ok(p.text.length<1200);}
 assert.match(demoPresets(s,'zh')[0].text,/接触/);assert.match(demoPresets(s,'en')[0].text,/contact/);
 assert.match(demoPresets(s,'zh')[0].text,/U=5\.884/);assert.match(demoPresets(s,'en')[0].text,/58839\.9/);
});
test('presets are phase-specific and do not generate answers during claim or confirmation',()=>{
 const s={phase:'claim',problem:{id:'flight'}};assert.equal(demoPresets(s,'en').length,3);
 assert.ok(demoPresets(s,'en').every(p=>!p.answer));s.phase='confirm';assert.deepEqual(demoPresets(s,'en'),[]);
 s.phase='complete';assert.deepEqual(demoPresets(s,'zh'),[]);
});
test('motion presets map the force and smoothness transfer field names',()=>{
 const s={phase:'transfer',problem:{id:'acceleration',formula:'motion-transfer-dynamics-default'},claim:{kind:'force-feasibility'},answerFields:[{key:'peakForceB'},{key:'gripRequiredB'}]};
 assert.deepEqual(demoPresets(s)[0].answer,{peakForceB:12000,gripRequiredB:.82});
 s.claim.kind='smoothness';s.answerFields=[{key:'peakAccelerationB'},{key:'peakJerkB'}];assert.deepEqual(demoPresets(s)[0].answer,{peakAccelerationB:8,peakJerkB:5.03});
});
test('ordinary motion transfer describes the actual falling profile rather than a primary cosine curve',()=>{
 const s={phase:'transfer',problem:{id:'acceleration',formula:'motion-transfer-default'},claim:{kind:'same-endpoints-distance'},answerFields:[{key:'averageAcceleration'},{key:'distanceDifference'}]};
 const p=demoPresets(s)[0];assert.match(p.text,/falling/);assert.doesNotMatch(p.text,/cosine/);assert.deepEqual(p.answer,{averageAcceleration:2,distanceDifference:8.33});
});
