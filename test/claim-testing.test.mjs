import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClaimSession, claimTools, assessClaim, advanceClaim, confirmClaim, claimView, replayClaimEvidence } from '../src/claim-testing.mjs';
const d=(action,text,extra={})=>({action,assessment:'supported',evidence:text,feedback:'Check the distinction.',question:'What follows?',reason:'Test a finite crossing.',focus:'concept',...extra});
const proposal=(text='At finite input an asymptote is a barrier.')=>d('propose_claim',text,{assessment:'misconception',kind:'finite-crossing',scope:'finite-inputs',interpretation:'The curve cannot cross its asymptote at finite input.',experimentId:'finite-crossing'});
const response=d=>({model:'test-model',toolCall:{name:d.action,arguments:JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k])=>k!=='action')))}});
function checked(language='en'){
 const s=createClaimSession(language),text=language==='zh'?'有限处不能穿过渐近线。':'At finite input an asymptote is a barrier.';
 advanceClaim(s,text,proposal(text));confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});
 advanceClaim(s,'I predict no crossing.',d('run_experiment','I predict no crossing.',{experimentId:'finite-crossing'}));return s;
}
function transferred(language='en'){
 const s=checked(language);advanceClaim(s,'A finite crossing does not change the end limit.',d('select_transfer','A finite crossing does not change the end limit.',{variantId:'alternate',evidenceIds:[s.evidenceRecords[0].id]}));return s;
}
test('claim interpretation requires explicit confirmation, which costs no model call',()=>{
 const s=createClaimSession('en');advanceClaim(s,proposal().evidence,proposal());
 assert.equal(s.phase,'confirm');assert.equal(s.claim.confirmed,false);assert.deepEqual(claimTools(s),[]);
 const before=JSON.stringify(s);assert.throws(()=>confirmClaim(s,{claimId:'stale',decision:'confirm'}));assert.equal(JSON.stringify(s),before);
 confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});assert.equal(s.phase,'prediction');assert.equal(s.evidenceRecords.length,0);
 assert.equal(s.history.length,1);assert.match(claimView(s).probe,/predict/i);
});
test('learner can reject the interpretation and resubmit their own words',()=>{
 const s=createClaimSession('zh');advanceClaim(s,'有限处不能穿过。',proposal('有限处不能穿过。'));const id=s.claim.id;
 confirmClaim(s,{claimId:id,decision:'revise'});assert.equal(s.phase,'claim');assert.equal(s.claim,null);
 assert.equal(s.claimRevisions[0].confirmed,false);assert.equal(s.before,'有限处不能穿过。');
});
test('scripted confirmation is explicit provenance and requires a demo session',()=>{
 const s=createClaimSession('en');advanceClaim(s,proposal().evidence,proposal());const options={claimId:s.claim.id,decision:'confirm',source:'scripted-demo'};
 assert.throws(()=>confirmClaim(s,options));s.demoUsed=true;confirmClaim(s,options);
 assert.equal(s.claim.confirmationSource,'scripted-demo');assert.equal(s.claimEvents.at(-1).source,'scripted-demo');
});
test('evidence requires confirmation and prediction; replay is deterministic',()=>{
 const s=createClaimSession('en');const before=JSON.stringify(s);
 assert.throws(()=>advanceClaim(s,'predict',d('run_experiment','predict',{experimentId:'finite-crossing'})));
 assert.equal(JSON.stringify(s),before);
 const c=checked();assert.equal(c.phase,'revision');assert.equal(c.evidenceRecords.length,1);
 assert.equal(replayClaimEvidence(c,c.evidenceRecords[0].id).verified,true);
 assert.equal(replayClaimEvidence(c,c.evidenceRecords[0].id).modelCalls,0);
 assert.throws(()=>replayClaimEvidence(createClaimSession('en'),c.evidenceRecords[0].id));
});
test('unknown or stale evidence cannot unlock transfer, without partial mutation',()=>{
 const s=checked();const before=JSON.stringify(s);
 for(const evidenceIds of [[],['fabricated'],[s.evidenceRecords[0].id,s.evidenceRecords[0].id]]) {
  assert.throws(()=>advanceClaim(s,'reason',d('select_transfer','reason',{variantId:'default',evidenceIds})));
  assert.equal(JSON.stringify(s),before);
 }
 s.evidenceRecords[0].claimId='old';assert.throws(()=>advanceClaim(s,'reason',d('select_transfer','reason',{variantId:'default',evidenceIds:[s.evidenceRecords[0].id]})));
});
test('separate learner values and model reasoning assessment gate completion',()=>{
 const s=transferred();const evidenceIds=[s.evidenceRecords[0].id];
 const final=d('compare_reasoning','Finite crossing and end behavior differ.',{evidenceIds,priorEvidence:s.before});
 for(const answer of [undefined,{asymptote:-1,crossingX:3},{asymptote:0,crossingX:-2}]){
  assert.throws(()=>advanceClaim(s,final.evidence,final,answer));assert.equal(s.phase,'transfer');
 }
 assert.throws(()=>advanceClaim(s,final.evidence,{...final,assessment:'ambiguous'},{asymptote:-1,crossingX:-2}));
 advanceClaim(s,final.evidence,final,{asymptote:-1,crossingX:-2});
 const v=claimView(s);assert.equal(v.phase,'complete');assert.equal(v.report.outcome,'independent');
 assert.equal(v.report.checkedAnswer.asymptote,-1);assert.equal(v.report.reasoningAssessment,'model-supported');
 assert.equal(v.report.evidenceIds.length,2);assert.equal(v.evidenceRecords.length,2);
});
test('transfer help is marked assisted; incomplete reasoning remains inconclusive',()=>{
 const s=transferred('zh');assert.equal(claimView(s).report.outcome,'insufficient');
 advanceClaim(s,'需要帮助',d('ask_clarification','需要帮助',{assessment:'ambiguous'}));
 advanceClaim(s,'有限交点与无穷远处的行为不同。',d('compare_reasoning','有限交点与无穷远处的行为不同。',{evidenceIds:[s.evidenceRecords[0].id],priorEvidence:s.before}),{asymptote:-1,crossingX:-2});
 assert.equal(claimView(s).report.outcome,'assisted');
});
test('known unscoped wording only allows clarification; no unsupported or invented claims',()=>{
 for(const [language,text] of [['en','It can never touch the asymptote.'],['zh','曲线永远碰不到渐近线。']]){
  const s=createClaimSession(language);assert.deepEqual(claimTools(s,text).map(t=>t.name),['ask_clarification']);
  assert.throws(()=>advanceClaim(s,text,proposal(text)));
 }
 const s=createClaimSession('en');assert.throws(()=>advanceClaim(s,'My text',proposal('invented quote')));
 assert.throws(()=>advanceClaim(s,'My text',{...proposal('My text'),kind:'unsupported'}));
});
test('Meta receives eligible native tools and checked results as untrusted data in both languages',async()=>{
 for(const language of ['en','zh']){
  const s=checked(language);let req;
  await assessClaim(s,'Need clarification',async a=>{req=a;return response(d('ask_clarification','Need clarification',{assessment:'ambiguous'}));});
  assert.match(req.instructions,language==='zh'?/Chinese/:/English/);
  assert.match(req.instructions,/untrusted/);assert.equal(JSON.parse(req.input).evidenceRecords.length,1);
  assert.ok(req.tools.some(t=>t.name==='select_transfer'));
  await assert.rejects(assessClaim(s,'text',async()=>({text:'not a tool call'})));
 }
});

test('native schemas constrain clarification and progression assessments before generation',()=>{
 const s=createClaimSession('zh');
 const clarify=claimTools(s,'曲线永远碰不到渐近线。')[0];
 assert.deepEqual(clarify.parameters.properties.assessment.enum,['ambiguous']);
 assert.equal(new Set(clarify.parameters.required).size,clarify.parameters.required.length);
 const c=checked();const transfer=claimTools(c,'reason').find(t=>t.name==='select_transfer');
 assert.deepEqual(transfer.parameters.properties.assessment.enum,['supported']);
});

test('claim decisions retain separate local confirmation provenance across a correction',()=>{
 const s=createClaimSession('en');advanceClaim(s,proposal().evidence,proposal());const old=s.claim.id;
 confirmClaim(s,{claimId:old,decision:'revise'});
 advanceClaim(s,'Finite crossing can occur.',{...proposal('Finite crossing can occur.'),assessment:'supported',interpretation:'Finite crossing is compatible with end behavior.'});
 const current=s.claim.id;confirmClaim(s,{claimId:current,decision:'confirm'});
 const events=claimView(s).claimEvents;
 assert.deepEqual(events.map(e=>e.action),['proposed','revise','proposed','confirm']);
 assert.equal(events[1].claimId,old);assert.equal(events[3].claimId,current);assert.equal(events[3].modelCalls,0);
});
test('completion schema binds the original quote to the first explanation, not a revision',()=>{
 const s=transferred(),schema=claimTools(s,'Finite crossing and end behavior differ.',{asymptote:-1,crossingX:-2}).find(t=>t.name==='compare_reasoning').parameters;
 assert.deepEqual(schema.properties.priorEvidence.enum,['At finite input an asymptote is a barrier.']);
});
test('completion rejects partial or wrong-source original quotes without mutation',()=>{
 const s=transferred(),text='Finite crossing and end behavior differ.',before=JSON.stringify(s);
 for(const priorEvidence of ['an asymptote is a barrier.',text]){
  assert.throws(()=>advanceClaim(s,text,d('compare_reasoning',text,{priorEvidence,evidenceIds:[s.evidenceRecords[0].id]}),{asymptote:-1,crossingX:-2}),e=>e.validationCode==='original-quote');
  assert.equal(JSON.stringify(s),before);
 }
 advanceClaim(s,text,d('compare_reasoning',text,{priorEvidence:s.before,evidenceIds:[s.evidenceRecords[0].id]}),{asymptote:-1,crossingX:-2});
 assert.equal(s.phase,'complete');assert.equal(s.report.originalQuote,'At finite input an asymptote is a barrier.');
});
test('claim confirmation asks to confirm the captured interpretation in the session language',()=>{
 for(const [language,want] of [['en','Does this interpretation match what you meant? Confirm it, or revise your claim.'],['zh','这段解读是否符合你的原意？请确认，或修改你的说法。']]){
  const s=createClaimSession(language),p=proposal();p.question='Would you replace your claim with the correct answer?';
  const v=advanceClaim(s,p.evidence,p);
  assert.equal(v.phase,'confirm');assert.equal(v.probe,want);assert.equal(v.claim.interpretation,p.interpretation);
  assert.equal(v.history[0].question,p.question); // Keep actual provider output inspectable.
 }
});
