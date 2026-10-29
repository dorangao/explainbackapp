import assert from 'node:assert/strict';import {test} from 'node:test';
import {createClaimSession,claimTools,advanceClaim,confirmClaim,claimView,replayClaimEvidence,assessClaim} from '../src/claim-testing.mjs';
const d=(action,text,extra={})=>({action,assessment:'supported',evidence:text,feedback:'Consider the motion model.',question:'Why?',reason:'Compare slopes and areas.',focus:'concept',...extra});
function checked(language='en',config={}){
 const s=createClaimSession(language,'acceleration',config),text=language==='zh'?'相同时间达到同样速度，瞬时加速度必然相同。':'Same final speed in the same time means identical acceleration throughout.';
 advanceClaim(s,text,d('propose_claim',text,{assessment:'misconception',kind:'average-vs-instantaneous',scope:'prescribed-motion-interval',interpretation:text,experimentId:'motion-acceleration'}));
 confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});
 advanceClaim(s,'I predict the same slopes.',d('run_experiment','I predict the same slopes.',{experimentId:'motion-acceleration'}));return s;
}
test('acceleration claims share confirmation, evidence, replay and graph workflow in both languages',()=>{
 for(const language of ['en','zh']){
  const s=checked(language,{speedMph:30,duration:2,profileB:'falling'}),v=claimView(s);
  assert.equal(v.problem.id,'acceleration');assert.equal(v.graph.kind,'motion');assert.equal(v.graph.scenario.T,2);
  assert.equal(v.evidenceRecords[0].formulaId,'motion-30-2-falling');assert.equal(replayClaimEvidence(s,v.evidenceRecords[0].id).verified,true);
  assert.match(v.assumptions,language==='zh'?/并非车辆实测/:/no measured vehicle/);
  assert.equal(v.answerFields[0].key,'averageAcceleration');
 }
});
test('motion schemas and claim experiment compatibility reject crossing facts and arbitrary scopes',()=>{
 const s=createClaimSession('en','acceleration');
 const proposal=claimTools(s,'words').find(t=>t.name==='propose_claim');
 assert.ok(proposal.parameters.properties.kind.enum.includes('average-vs-instantaneous'));
 assert.ok(proposal.parameters.properties.kind.enum.includes('same-endpoints-distance'));
 for(const extra of [{kind:'finite-crossing',scope:'finite-inputs',experimentId:'finite-crossing'},
  {kind:'same-endpoints-distance',scope:'prescribed-motion-interval',experimentId:'motion-acceleration'}]){
  const before=JSON.stringify(s);
  assert.throws(()=>advanceClaim(s,'words',d('propose_claim','words',{interpretation:'words',...extra})));
  assert.equal(JSON.stringify(s),before);
 }
});
test('fresh motion transfer hides answers/graph and requires both checked numbers and supported reasoning',()=>{
 const s=checked();advanceClaim(s,'Average is equal but slopes and areas can differ.',d('select_transfer','Average is equal but slopes and areas can differ.',{variantId:'default',evidenceIds:[s.evidenceRecords[0].id]}));
 const v=claimView(s);assert.equal(v.graph,null);assert.equal(v.report.outcome,'insufficient');assert.doesNotMatch(JSON.stringify(v.problem),/distanceDifference|8\.333/);
 const final=d('compare_reasoning','The integral of velocity sets distance.',{priorEvidence:s.before,evidenceIds:[s.evidenceRecords[0].id]});
 for(const answer of [{averageAcceleration:2,distanceDifference:-8.33},{asymptote:2,crossingX:3},{averageAcceleration:2.02,distanceDifference:8.33}])assert.throws(()=>advanceClaim(s,final.evidence,final,answer));
 assert.throws(()=>advanceClaim(s,final.evidence,{...final,assessment:'ambiguous'},{averageAcceleration:2,distanceDifference:8.33}));
 advanceClaim(s,final.evidence,final,{averageAcceleration:2,distanceDifference:8.33});
 assert.equal(s.report.outcome,'independent');assert.equal(s.report.checkedAnswer.distanceDifference,8.33);assert.equal(s.evidenceRecords.length,2);
});
test('transfer graph help counts as assistance; old scenario evidence cannot unlock a changed session',()=>{
 const s=checked();s.evidenceRecords[0].inputs.T=9;
 assert.throws(()=>advanceClaim(s,'reason',d('select_transfer','reason',{variantId:'default',evidenceIds:[s.evidenceRecords[0].id]})));
 const c=checked();advanceClaim(c,'slopes differ',d('select_transfer','slopes differ',{variantId:'alternate',evidenceIds:[c.evidenceRecords[0].id]}));
 advanceClaim(c,'Please show the graph.',d('reveal_graph','Please show the graph.'));
 assert.equal(claimView(c).graph.scenario.id,'motion-transfer-alternate');
 advanceClaim(c,'Different areas despite equal endpoint speeds.',d('compare_reasoning','Different areas despite equal endpoint speeds.',{priorEvidence:c.before,evidenceIds:[c.evidenceRecords[0].id]}),{averageAcceleration:5,distanceDifference:-13.33});
 assert.equal(c.report.outcome,'assisted');
});
test('motion model instructions, verified facts and learner values stay distinct from untrusted language',async()=>{
 const s=checked('zh');let req;
 await assessClaim(s,'解释',async a=>{req=a;return {model:'fixture',toolCall:{name:'ask_clarification',arguments:JSON.stringify(Object.fromEntries(Object.entries(d('ask_clarification','解释',{assessment:'ambiguous'})).filter(([k])=>k!=='action')))}};});
 assert.match(req.instructions,/Chinese/);assert.match(req.instructions,/HYPOTHETICAL/);assert.match(req.instructions,/not measured vehicle/);assert.doesNotMatch(req.instructions,/finite crossing versus end behavior/);
 assert.equal(JSON.parse(req.input).evidenceRecords[0].method,'prescribed-velocity-calculus-v1');
});
