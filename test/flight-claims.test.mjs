import assert from 'node:assert/strict';import {test} from 'node:test';
import {createClaimSession,advanceClaim,confirmClaim,claimView,claimTools,replayClaimEvidence,assessClaim} from '../src/claim-testing.mjs';
const d=(action,text,extra={})=>({action,assessment:'supported',evidence:text,feedback:'Use the model and its limits.',question:'Why?',reason:'Compare angular and linear motion.',focus:'concept',...extra});
function checked(kind,experimentId,language='en'){
 const s=createClaimSession(language,'flight',{airtime:2,massKg:2800,landingProfile:'pulse'}),text='Returning upright must mean no rotation and no landing force.';
 assert.equal(claimView(s).graph,null);
 advanceClaim(s,text,d('propose_claim',text,{assessment:'misconception',kind,scope:'ideal-flight-and-contact',interpretation:text,experimentId}));
 assert.equal(s.evidenceRecords.length,0);confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});
 advanceClaim(s,'I predict zero spin and contact force.',d('run_experiment','I predict zero spin and contact force.',{experimentId}));return s;
}
test('flight torque claim uses confirmed gated evidence, replay and a distinct torque transfer',()=>{
 const s=checked('rotation-torque','flight-torque'),e=s.evidenceRecords[0];
 assert.equal(claimView(s).graph.kind,'flight');assert.equal(e.inputs.massKg,2800);assert.equal(e.result.touchdownOmegaB,0);assert.ok(e.result.touchdownOmegaA>0);
 assert.equal(replayClaimEvidence(s,e.id).verified,true);
 advanceClaim(s,'Angle is not angular speed; positive then negative torque starts and stops B.',d('select_transfer','Angle is not angular speed; positive then negative torque starts and stops B.',{variantId:'default',evidenceIds:[e.id]}));
 const v=claimView(s);assert.equal(v.graph,null);assert.equal(v.problem.formula,'flight-transfer-default');assert.deepEqual(v.answerFields.map(f=>f.key),['peakTorque','touchdownOmegaA']);
 assert.doesNotMatch(JSON.stringify(v.problem),/26318|5\.235/);
 const done=d('compare_reasoning','Torque is Iα; zero net angular impulse is not zero torque throughout. A retains its initial angular momentum.',{priorEvidence:s.before,evidenceIds:[e.id]});
 assert.throws(()=>advanceClaim(s,done.evidence,done,{peakTorque:0,touchdownOmegaA:0}));
 advanceClaim(s,done.evidence,done,{peakTorque:26318.95,touchdownOmegaA:5.24});assert.equal(s.report.outcome,'independent');
});
test('landing impulse transfer distinguishes average/peak and marks graph help assisted',()=>{
 const s=checked('landing-impulse','flight-contact','zh'),e=s.evidenceRecords[0];
 assert.ok(e.result.peakContactForce>e.result.averageContactForce);
 advanceClaim(s,'接触力还要克服重力，平均值不能决定峰值。',d('select_transfer','接触力还要克服重力，平均值不能决定峰值。',{variantId:'alternate',evidenceIds:[e.id]}));
 assert.deepEqual(claimView(s).answerFields.map(f=>f.key),['averageContactForce','peakContactForce']);
 advanceClaim(s,'请给图像。',d('reveal_graph','请给图像。'));
 const done=d('compare_reasoning','平均接触力=mg+mU/D，余弦脉冲的动态峰值加倍，不能据此判定安全。',{priorEvidence:s.before,evidenceIds:[e.id]});
 advanceClaim(s,done.evidence,done,{averageContactForce:22064.96,peakContactForce:34323.28});assert.equal(s.report.outcome,'assisted');
});
test('landing state checks both downward speed and unresolved spin; tampered evidence fails closed',()=>{
 const s=checked('landing-state','flight-state'),e=s.evidenceRecords[0];
 e.inputs.stopTime=0;
 assert.throws(()=>advanceClaim(s,'reason',d('select_transfer','reason',{variantId:'default',evidenceIds:[e.id]})));
 const c=checked('landing-state','flight-state'),id=c.evidenceRecords[0].id;
 advanceClaim(c,'Upright alone omits downward velocity, spin and impact loads.',d('select_transfer','Upright alone omits downward velocity, spin and impact loads.',{variantId:'alternate',evidenceIds:[id]}));
 const answer={impactSpeed:4.9,touchdownOmegaA:6.28};
 assert.ok(claimTools(c,'reason',answer).some(t=>t.name==='compare_reasoning'));
 assert.ok(!claimTools(c,'reason',{impactSpeed:4.9,touchdownOmegaA:0}).some(t=>t.name==='compare_reasoning'));
 assert.equal(claimView(c).graph,null);assert.equal(claimView(c).report.outcome,'insufficient');
});
test('flight model context is bilingual, scoped, and rejects incompatible experiment selections',async()=>{
 const s=checked('rotation-torque','flight-torque','zh');let input;
 await assessClaim(s,'再解释',async req=>{input=req;const x=d('ask_clarification','再解释',{assessment:'ambiguous'});delete x.action;return {model:'fixture',toolCall:{name:'ask_clarification',arguments:JSON.stringify(x)}};});
 assert.match(input.instructions,/Chinese/);assert.match(input.instructions,/not measured vehicle/);assert.match(input.instructions,/angular momentum/);assert.match(input.instructions,/not.*safe|no.*safety/i);
 const f=createClaimSession('en','flight');assert.throws(()=>advanceClaim(f,'test',d('propose_claim','test',{kind:'landing-impulse',scope:'ideal-flight-and-contact',interpretation:'test',experimentId:'flight-torque'})));
});
test('a preset or trace-assisted first transfer never becomes independent evidence',()=>{
 const s=checked('rotation-torque','flight-torque'),id=s.evidenceRecords[0].id;s.demoUsed=true;
 advanceClaim(s,'Torque changes spin.',d('select_transfer','Torque changes spin.',{variantId:'default',evidenceIds:[id]}));
 advanceClaim(s,'I alpha and nonzero residual spin.',d('compare_reasoning','I alpha and nonzero residual spin.',{priorEvidence:s.before,evidenceIds:[id]}),{peakTorque:26318.95,touchdownOmegaA:5.24});
 assert.equal(s.report.outcome,'assisted');assert.equal(claimView(s).demoUsed,true);
});
