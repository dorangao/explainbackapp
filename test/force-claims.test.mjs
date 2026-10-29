import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createClaimSession,advanceClaim,confirmClaim,claimView,claimTools,replayClaimEvidence} from '../src/claim-testing.mjs';
import {executeMotionExperiment} from '../src/motion-evidence.mjs';
const d=(action,text,extra={})=>({action,assessment:'supported',evidence:text,feedback:'Check the model limits.',question:'Why?',reason:'Use the checked evidence.',focus:'concept',...extra});
function checked(kind,experimentId,language='en'){
 const s=createClaimSession(language,'acceleration',{profileB:'smooth',massKg:2800});
 const text=kind==='force-feasibility'?'The same target motion needs the same force regardless of mass.':'Using sine and cosine guarantees a comfortable feasible ride.';
 advanceClaim(s,text,d('propose_claim',text,{assessment:'misconception',kind,scope:'prescribed-motion-interval',interpretation:text,experimentId}));
 confirmClaim(s,{claimId:s.claim.id,decision:'confirm'});
 advanceClaim(s,'I predict no limit is exceeded.',d('run_experiment','I predict no limit is exceeded.',{experimentId}));
 return s;
}
test('force claims bind mass/grip/power to replayable evidence and get a relevant fresh numeric transfer',()=>{
 const s=checked('force-feasibility','motion-force'),e=s.evidenceRecords[0];
 assert.equal(e.inputs.massKg,2800);assert.equal(e.result.B.withinLimits,false);
 assert.equal(replayClaimEvidence(s,e.id).verified,true);
 advanceClaim(s,'Mass scales force and power; these ideal limits do not prove real feasibility.',d('select_transfer','Mass scales force and power; these ideal limits do not prove real feasibility.',{variantId:'default',evidenceIds:[e.id]}));
 const v=claimView(s);assert.equal(v.graph,null);assert.deepEqual(v.answerFields.map(f=>f.key),['peakForceB','gripRequiredB']);
 assert.doesNotMatch(JSON.stringify(v.problem),/12000|0\.815/);
 const complete=d('compare_reasoning','Peak acceleration sets peak force; compare it with μmg and also check wheel power.',{priorEvidence:s.before,evidenceIds:[e.id]});
 assert.throws(()=>advanceClaim(s,complete.evidence,complete,{peakForceB:6000,gripRequiredB:.41}));
 advanceClaim(s,complete.evidence,complete,{peakForceB:12000,gripRequiredB:.82});
 assert.equal(s.report.outcome,'independent');assert.equal(s.evidenceRecords[1].inputs.massKg,1500);
});
test('smoothness claim transfer checks peak acceleration and jerk, with help counted',()=>{
 const s=checked('smoothness','motion-smoothness','zh'),e=s.evidenceRecords[0];
 assert.equal(e.result.A.endpointJumps,true);assert.equal(e.result.B.endpointJumps,false);
 advanceClaim(s,'连续起步不等于舒适；峰值加速度和加加速度仍重要。',d('select_transfer','连续起步不等于舒适；峰值加速度和加加速度仍重要。',{variantId:'default',evidenceIds:[e.id]}));
 assert.deepEqual(claimView(s).answerFields.map(f=>f.key),['peakAccelerationB','peakJerkB']);
 advanceClaim(s,'请显示图像。',d('reveal_graph','请显示图像。'));
 const complete=d('compare_reasoning','余弦脉冲在两端的加速度与加加速度为零，但峰值仍非零，不能保证舒适。',{priorEvidence:s.before,evidenceIds:[e.id]});
 advanceClaim(s,complete.evidence,complete,{peakAccelerationB:8,peakJerkB:5.03});
 assert.equal(s.report.outcome,'assisted');
});
test('new claim kinds cannot select incompatible experiments; physics tampering blocks transfer',()=>{
 const s=checked('force-feasibility','motion-force');s.evidenceRecords[0].inputs.massKg=1;
 assert.throws(()=>advanceClaim(s,'reason',d('select_transfer','reason',{variantId:'default',evidenceIds:[s.evidenceRecords[0].id]})));
 const fresh=createClaimSession('en','acceleration');
 assert.ok(claimTools(fresh,'force').find(t=>t.name==='propose_claim').parameters.properties.kind.enum.includes('smoothness'));
 assert.throws(()=>advanceClaim(fresh,'force',d('propose_claim','force',{kind:'force-feasibility',scope:'prescribed-motion-interval',interpretation:'force',experimentId:'motion-distance'})));
});
test('cosine evidence uses a distinguishing midpoint and does not falsely report unequal distances',()=>{
 const args={sessionId:'s',claimId:'c',formulaId:'motion-60-1-smooth',evidenceId:'e'};
 const acceleration=executeMotionExperiment({...args,experimentId:'motion-acceleration'});
 assert.equal(acceleration.result.witnessTime,.5);assert.equal(acceleration.result.witnessAccelerationB,53.6448);
 const distance=executeMotionExperiment({...args,experimentId:'motion-distance'});
 assert.equal(distance.result.distanceDifference,0);
 assert.match(distance.conclusion.en,/equal|same/i);
 assert.doesNotMatch(distance.conclusion.en,/but A travels/);
});
