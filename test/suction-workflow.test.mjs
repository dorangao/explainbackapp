import test from 'node:test';import assert from 'node:assert/strict';
import {createClaimSession,advanceClaim,confirmClaim,claimTools,claimView,replayClaimEvidence} from '../src/claim-testing.mjs';
const d=(action,extra={})=>({action,assessment:'supported',evidence:'reason',feedback:'Check the evidence.',question:'What follows?',reason:'Compare forces.',focus:'concept',...extra});
function checked(){const s=createClaimSession('en','suction');advanceClaim(s,'reason',d('propose_claim',{kind:'all-angle-grip',scope:'sealed-static-model',interpretation:'Ceiling support implies every angle works.',experimentId:'suction-orientation'}));confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});advanceClaim(s,'reason',d('run_experiment',{experimentId:s.claim.experimentId}));return s;}
const design=s=>d('propose_design',{candidateId:'reduce-leakage',nextMeasurement:'Measure the pressure-flow curve and leakage with debris.',validationStatus:'unvalidated_model_only',ceilingReactionDirection:'downward_away_from_ceiling',evidenceIds:[s.evidenceRecords[0].id]});
test('suction revision requires a checked design stage before transfer',()=>{
 const s=checked();assert.ok(!claimTools(s).some(t=>t.name==='select_transfer'));assert.ok(claimTools(s).some(t=>t.name==='propose_design'));
 advanceClaim(s,'reason',design(s));assert.equal(s.phase,'design-review');assert.equal(s.evidenceRecords.length,2);assert.equal(s.evidenceRecords[1].experimentId,'suction-design');
 assert.equal(replayClaimEvidence(s,s.evidenceRecords[1].id).verified,true);
 assert.equal(claimView(s).designProposal.candidateId,'reduce-leakage');
 assert.throws(()=>advanceClaim(s,'reason',d('select_transfer',{variantId:'default',evidenceIds:[s.evidenceRecords[0].id]})));
 advanceClaim(s,'reason',d('select_transfer',{variantId:'default',evidenceIds:s.evidenceRecords.map(e=>e.id)}));
 assert.equal(s.phase,'transfer');assert.equal(claimView(s).graph,null);
 assert.ok(!claimTools(s,'reason',{minPressurePa:2000,frictionAtPressureN:16}).some(t=>t.name==='compare_reasoning'));
 advanceClaim(s,'reason',d('compare_reasoning',{priorEvidence:s.before,evidenceIds:s.evidenceRecords.map(e=>e.id)}),{minPressurePa:2451.66,frictionAtPressureN:16});
 assert.equal(s.phase,'complete');assert.equal(s.report.evidenceIds.length,3);
});
test('design shape, provenance and replay are validated before any mutation',()=>{
 const s=checked(),before=JSON.stringify(s);
 for(const extra of [{candidateId:'invented'},{validationStatus:'False'},{ceilingReactionDirection:'upward'},{nextMeasurement:''},{evidenceIds:['fake']}]){
  assert.throws(()=>advanceClaim(s,'reason',{...design(s),...extra}));assert.equal(JSON.stringify(s),before);
 }
 s.evidenceRecords[0].result.orientations[0].normalN=0;
 assert.throws(()=>advanceClaim(s,'reason',design(s)));assert.equal(s.phase,'revision');
});
test('foreign design evidence cannot satisfy citations and report remains insufficient',()=>{
 const a=checked(),b=checked();advanceClaim(a,'reason',design(a));advanceClaim(b,'reason',design(b));
 const foreign=structuredClone(b.evidenceRecords[1]);a.evidenceRecords[1]=foreign;
 assert.throws(()=>advanceClaim(a,'reason',d('select_transfer',{variantId:'default',evidenceIds:a.evidenceRecords.map(e=>e.id)})));
 assert.equal(claimView(a).report.outcome,'insufficient');
});

test('native progression schemas require both suction evidence citations',()=>{
 const s=checked();advanceClaim(s,'reason',design(s));
 const select=claimTools(s).find(t=>t.name==='select_transfer').parameters.properties.evidenceIds;
 assert.equal(select.minItems,2);assert.equal(select.maxItems,2);assert.equal(select.items.enum.length,2);
 advanceClaim(s,'reason',d('select_transfer',{variantId:'default',evidenceIds:s.evidenceRecords.map(e=>e.id)}));
 const compare=claimTools(s,'reason',{minPressurePa:2451.66,frictionAtPressureN:16}).find(t=>t.name==='compare_reasoning').parameters.properties.evidenceIds;
 assert.equal(compare.minItems,2);assert.match(compare.description,/BOTH/);
 const before=JSON.stringify(s);assert.throws(()=>advanceClaim(s,'reason',d('compare_reasoning',{priorEvidence:s.before,evidenceIds:[s.evidenceRecords[0].id]}),{minPressurePa:2451.66,frictionAtPressureN:16}),e=>e.validationCode==='suction-evidence-pair');assert.equal(JSON.stringify(s),before);
});

test('Muse can focus a checked visual without modifying pinned evidence or accepting unavailable views',()=>{
 const s=checked(),before=JSON.stringify(s),evidence=JSON.stringify(s.evidenceRecords);
 for(const visualFocus of ['robot','design','invented']){assert.throws(()=>advanceClaim(s,'reason',d('reveal_graph',{visualFocus})));assert.equal(JSON.stringify(s),before);}
 advanceClaim(s,'reason',d('reveal_graph',{visualFocus:'leakage'}));assert.equal(s.phase,'revision');assert.equal(claimView(s).graph.focus,'leakage');assert.equal(JSON.stringify(s.evidenceRecords),evidence);
 advanceClaim(s,'reason',design(s));assert.equal(claimView(s).graph.focus,'design');
 advanceClaim(s,'reason',d('select_transfer',{variantId:'default',evidenceIds:s.evidenceRecords.map(e=>e.id)}));
 assert.deepEqual(claimTools(s).find(t=>t.name==='reveal_graph').parameters.properties.visualFocus.enum,['robot']);
 advanceClaim(s,'reason',d('reveal_graph',{visualFocus:'robot'}));assert.equal(claimView(s).graph.focus,'robot');
 advanceClaim(s,'reason',d('compare_reasoning',{priorEvidence:s.before,evidenceIds:s.evidenceRecords.map(e=>e.id)}),{minPressurePa:2451.66,frictionAtPressureN:16});assert.equal(s.report.outcome,'assisted');
});
