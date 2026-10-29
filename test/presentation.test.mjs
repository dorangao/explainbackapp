import test from 'node:test';import assert from 'node:assert/strict';
import {demoPresentation,defaultSuctionFocus} from '../public/presentation.mjs';
test('guided presentation has four milestones and one relevant suction visual per stage',()=>{
 for(const language of ['en','zh']){assert.equal(demoPresentation('tilt',language,true).labels.length,4);assert.equal(demoPresentation('claim',language,true).current,0);assert.equal(demoPresentation('tilt',language,true).current,1);assert.equal(demoPresentation('design-review',language,true).current,2);assert.equal(demoPresentation('complete',language,true).current,3);}
 assert.equal(demoPresentation('ceiling','en',true).focus,'ceiling');assert.equal(demoPresentation('leakage','en',true).focus,'leakage');assert.equal(demoPresentation('tilt','en',true).focus,'orientation');
});
test('a model-selected visual overrides the default without changing the source session',()=>{
 const s={claim:{kind:'all-angle-grip'},graph:{focus:'leakage'},designProposal:{candidateId:'reduce-leakage'}};const before=JSON.stringify(s);assert.equal(defaultSuctionFocus(s),'leakage');assert.equal(JSON.stringify(s),before);assert.equal(defaultSuctionFocus({claim:{kind:'stationary-pressure'}}),'pressure');
});
test('Vehicle guide focuses the graph for the active model without changing its timeline',()=>{
 assert.equal(demoPresentation('acceleration').journeyFocus,0);
 assert.equal(demoPresentation('flip').journeyFocus,1);
 assert.equal(demoPresentation('landing').journeyFocus,2);
 assert.equal(demoPresentation('revision').journeyFocus,1);
});
