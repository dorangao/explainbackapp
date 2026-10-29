import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import { createApp } from '../src/server.mjs';

async function running(t, modelCall) {
  const server = createApp({testerCredentials, configured: true, modelCall });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cookie=await testerCookie(origin);
  const post = (path, body) => fetch(origin + path, { method: 'POST', headers: { Cookie:cookie, 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  return { origin, post, cookie };
}
const start = { problemId: 'crossing', language: 'en', synthetic: true };
const clarification = (text, feedback='Clarify.', question='Which end?') => ({ model:'test', toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:text,feedback,question,reason:'Clarify the meaning before judging.',focus:'meaning'})} });

test('serves the workspace but never serves environment or server files', async t => {
  const { origin } = await running(t);
  const page = await fetch(origin);
  // The page comes from the Vite build in dist/ when present; the API never serves source files.
  assert.ok([200, 404].includes(page.status));
  if (page.status === 200) assert.match(await page.text(), /ExplainBack/);
  for (const path of ['/.env.local', '/src/meta.mjs', '/package.json', '/docs/', '/assets/../.env.local']) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
});

test('legacy shell modules are no longer served and repository files stay private', async t => {
  const { origin } = await running(t);
  for (const path of ['/assets/app.mjs', '/assets/lesson-studio.mjs', '/assets/lesson-schema.mjs', '/frontend/App.tsx', '/public/gallery-lessons.mjs']) {
    assert.equal((await fetch(origin + path)).status, 404, path);
  }
  const auth = await fetch(origin + '/api/auth');
  assert.equal(auth.status, 200);
});

test('rejects cross-origin requests and requires synthetic examples', async t => {
  const { origin, post, cookie } = await running(t);
  assert.equal((await fetch(origin + '/api/session', { method: 'POST', headers: { Cookie:cookie, Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(start) })).status, 403);
  assert.equal((await post('/api/session', { ...start, synthetic: false })).status, 400);
  assert.equal((await post('/api/session', { ...start, problemId: '__proto__' })).status, 400);
  const status = await new Promise((resolve, reject) => {
    const req = request(origin + '/api/status', { headers: { Host: 'example.com' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(status, 403);
});

test('reset during an in-flight request discards the stale result', async t => {
  let release;
  const { post } = await running(t, async args => {
    await new Promise(resolve => { release = resolve; });
    return clarification(JSON.parse(args.input).explanation);
  });
  const initial = await (await post('/api/session', start)).json();
  const pending = post('/api/turn', { sessionId: initial.sessionId, explanation: 'synthetic explanation' });
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  await post('/api/reset', { sessionId: initial.sessionId });
  release();
  assert.equal((await pending).status, 409);
});

test('HTTP session carries learner reasoning through a live-adapter turn', async t => {
  const { post } = await running(t, async args => clarification(JSON.parse(args.input).explanation,'Please distinguish finite inputs from end behavior.','What does never mean here?'));
  const initial = await (await post('/api/session', start)).json();
  const response = await post('/api/turn', { sessionId: initial.sessionId, explanation: 'never touches' });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.phase, 'explain');
  assert.equal(body.history[0].assessment, 'ambiguous');
  assert.equal(body.attemptsRemaining, 11);
  assert.equal((await post('/api/reset', { sessionId: initial.sessionId })).status, 200);
  assert.equal((await post('/api/turn', { sessionId: initial.sessionId, explanation: 'hello' })).status, 404);
});

test('upstream failures are safe and do not advance the learning state', async t => {
  const { post } = await running(t, async () => { throw new Error('test-secret should not reach browser'); });
  const initial = await (await post('/api/session', start)).json();
  const failed = await post('/api/turn', { sessionId: initial.sessionId, explanation: 'I think it never touches.' });
  assert.equal(failed.status, 502);
  const body = await failed.text();
  assert.doesNotMatch(body, /test-secret/);
  assert.equal(JSON.parse(body).attemptsRemaining, 11);
});

test('Chinese text survives split UTF-8 bytes in an HTTP body', async t => {
  let observed;
  const { origin, post, cookie } = await running(t, async args => {
    observed = JSON.parse(args.input).explanation;
    return clarification(observed,'请澄清。','指哪一端？');
  });
  const initial = await (await post('/api/session', { ...start, language: 'zh' })).json();
  const buffer = Buffer.from(JSON.stringify({ sessionId: initial.sessionId, explanation: '不会碰到' }));
  const split = buffer.indexOf(Buffer.from('不')) + 1;
  const status = await new Promise((resolve, reject) => {
    const req = request(origin + '/api/turn', { method: 'POST', headers: { Cookie:cookie, Origin: origin, 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.write(buffer.subarray(0, split));
    setTimeout(() => req.end(buffer.subarray(split)), 5);
  });
  assert.equal(status, 200);
  assert.equal(observed, '不会碰到');
});

test('the request body and per-session attempt caps are enforced', async t => {
  let calls = 0;
  const { post } = await running(t, async args => {
    calls++;
    return clarification(JSON.parse(args.input).explanation);
  });
  assert.equal((await post('/api/session', { ...start, padding: 'x'.repeat(17000) })).status, 413);
  const initial = await (await post('/api/session', start)).json();
  for (let i=0;i<12;i++) assert.equal((await post('/api/turn', { sessionId: initial.sessionId, explanation: 'never' })).status, 200);
  assert.equal((await post('/api/turn', { sessionId: initial.sessionId, explanation: 'never' })).status, 429);
  assert.equal(calls, 12);
});

test('oversized input and duplicate requests cannot cause extra model calls', async t => {
  let calls = 0;
  let release;
  const { post } = await running(t, async args => {
    calls++;
    await new Promise(resolve => { release = resolve; });
    return clarification(JSON.parse(args.input).explanation);
  });
  const initial = await (await post('/api/session', start)).json();
  assert.equal((await post('/api/turn', { sessionId: initial.sessionId, explanation: 'x'.repeat(1201) })).status, 400);
  assert.equal(calls, 0);
  const first = post('/api/turn', { sessionId: initial.sessionId, explanation: 'never' });
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  const duplicate = await post('/api/turn', { sessionId: initial.sessionId, explanation: 'never' });
  assert.equal(duplicate.status, 409);
  release();
  assert.equal((await first).status, 200);
  assert.equal(calls, 1);
});

const claimStart={...start,workflow:'claim-testing'};
function native(d){return {model:'test-model',toolCall:{name:d.action,arguments:JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k])=>k!=='action')))}};}
const claimDecision=(action,text,extra={})=>({action,evidence:text,assessment:'supported',feedback:'Check the evidence.',question:'Why?',reason:'Test the claim.',focus:'concept',...extra});
test('claim HTTP flow confirms locally, checks evidence, replays without Meta, and completes checked transfer',async t=>{
 let calls=0;
 const {post}=await running(t,async args=>{
  calls++;const input=JSON.parse(args.input);const text=input.explanation;
  if(input.phase==='claim')return native(claimDecision('propose_claim',text,{assessment:'misconception',kind:'finite-crossing',scope:'finite-inputs',interpretation:'No finite crossing is possible.',experimentId:'finite-crossing'}));
  if(input.phase==='prediction')return native(claimDecision('run_experiment',text,{experimentId:'finite-crossing'}));
  if(input.phase==='revision')return native(claimDecision('select_transfer',text,{variantId:'alternate',evidenceIds:[input.evidenceRecords[0].id]}));
  return native(claimDecision('compare_reasoning',text,{priorEvidence:input.originalExplanation,evidenceIds:[input.evidenceRecords[0].id]}));
 });
 let s=await (await post('/api/session',claimStart)).json();assert.equal(s.phase,'claim');
 const other=await (await post('/api/session',claimStart)).json();
 const turn=async(explanation,answer)=>{const r=await post('/api/turn',{sessionId:s.sessionId,explanation,...(answer?{answer}:{})});assert.equal(r.status,200);s=await r.json();};
 await turn('There is no crossing at any finite input.');assert.equal(s.phase,'confirm');
 assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'skip confirmation'})).status,400);assert.equal(calls,1);
 assert.equal((await post('/api/claim',{sessionId:s.sessionId,claimId:'wrong',decision:'confirm'})).status,400);
 const confirmed=await post('/api/claim',{sessionId:s.sessionId,claimId:s.claim.id,decision:'confirm'});assert.equal(confirmed.status,200);s=await confirmed.json();assert.equal(calls,1);
 await turn('I predict that the curve stays above the line.');assert.equal(s.phase,'revision');
 const id=s.evidenceRecords[0].id;
 const replay=await post('/api/replay',{sessionId:s.sessionId,evidenceId:id});assert.equal(replay.status,200);assert.equal((await replay.json()).modelCalls,0);assert.equal(calls,2);
 assert.equal((await post('/api/replay',{sessionId:other.sessionId,evidenceId:id})).status,404);
 await turn('The sign changes at the finite crossing while the remainder tends to zero at both ends.');
 assert.equal(s.phase,'transfer');
 await turn('The zero of the remainder gives a finite crossing, compatible with its end limit.',{asymptote:-1,crossingX:-2});
 assert.equal(s.phase,'complete');assert.equal(s.report.outcome,'independent');assert.equal(calls,4);
 assert.equal(s.evidenceRecords.length,2);
 await post('/api/reset',{sessionId:s.sessionId});
 assert.equal((await post('/api/replay',{sessionId:s.sessionId,evidenceId:id})).status,404);
});
test('claim sessions reject invalid workflow and malformed answers before any API request',async t=>{
 let calls=0;const {post}=await running(t,async()=>{calls++;throw new Error('not expected');});
 assert.equal((await post('/api/session',{...claimStart,problemId:'ends'})).status,400);
 assert.equal((await post('/api/session',{...claimStart,workflow:'arbitrary'})).status,400);
 const s=await (await post('/api/session',claimStart)).json();
 assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'test',answer:{asymptote:'-1',crossingX:-2}})).status,400);
 assert.equal(calls,0);
});

test('claim confirmation and replay cannot race a teaching request; reset discards its result',async t=>{
 let release;
 const {post}=await running(t,async args=>{await new Promise(r=>{release=r;});return clarification(JSON.parse(args.input).explanation);});
 const s=await(await post('/api/session',claimStart)).json();
 const pending=post('/api/turn',{sessionId:s.sessionId,explanation:'A vague claim'});
 while(!release)await new Promise(r=>setTimeout(r,1));
 assert.equal((await post('/api/claim',{sessionId:s.sessionId,claimId:'anything',decision:'confirm'})).status,409);
 assert.equal((await post('/api/replay',{sessionId:s.sessionId,evidenceId:'anything'})).status,409);
 await post('/api/reset',{sessionId:s.sessionId});release();assert.equal((await pending).status,409);
});
test('expired claim sessions cannot confirm or replay and send no model request',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});let calls=0;
 const {post}=await running(t,async()=>{calls++;throw new Error('not expected');});
 const s=await(await post('/api/session',claimStart)).json();t.mock.timers.tick(30*60_000+1);
 assert.equal((await post('/api/claim',{sessionId:s.sessionId,claimId:'anything',decision:'confirm'})).status,404);
 assert.equal((await post('/api/replay',{sessionId:s.sessionId,evidenceId:'anything'})).status,404);assert.equal(calls,0);
});

test('acceleration HTTP flow binds settings and uses motion-specific transfer answers',async t=>{
 let calls=0;const {post,origin,cookie}=await running(t,async args=>{
  calls++;const i=JSON.parse(args.input),text=i.explanation;
  if(i.phase==='claim')return native(claimDecision('propose_claim',text,{assessment:'misconception',kind:'same-endpoints-distance',scope:'prescribed-motion-interval',interpretation:'Equal endpoints mean equal distances.',experimentId:'motion-distance'}));
  if(i.phase==='prediction')return native(claimDecision('run_experiment',text,{experimentId:'motion-distance'}));
  if(i.phase==='revision')return native(claimDecision('select_transfer',text,{variantId:'default',evidenceIds:[i.evidenceRecords[0].id]}));
  return native(claimDecision('compare_reasoning',text,{priorEvidence:i.originalExplanation,evidenceIds:[i.evidenceRecords[0].id]}));
 });
 assert.ok((await(await fetch(origin+'/api/status',{headers:{Cookie:cookie}})).json()).problems.some(p=>p.id==='acceleration'));
 let s=await(await post('/api/session',{...claimStart,problemId:'acceleration',motion:{speedMph:90,duration:3,profileB:'falling'}})).json();
 assert.equal(s.problem.id,'acceleration');assert.equal(s.graph,null);assert.match(s.assumptions,/Hypothetical/);
 const turn=async(explanation,answer)=>{const r=await post('/api/turn',{sessionId:s.sessionId,explanation,...(answer?{answer}:{})});assert.equal(r.status,200);s=await r.json();};
 await turn('The same final speeds in the same time force equal distances.');
 s=await(await post('/api/claim',{sessionId:s.sessionId,claimId:s.claim.id,decision:'confirm'})).json();
 await turn('I predict equal distances.');assert.equal(s.graph.scenario.id,'motion-90-3-falling');
 assert.equal(s.evidenceRecords[0].inputs.T,3);
 await turn('Distance depends on the full velocity integral, so the same endpoint speeds do not force the same distance.');
 assert.equal(s.graph,null);
 assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'reason',answer:{asymptote:2,crossingX:3}})).status,400);
 await turn('The average acceleration is shared, but the falling-acceleration profile has greater area under velocity.',{averageAcceleration:2,distanceDifference:8.33});
 assert.equal(s.report.outcome,'independent');assert.equal(calls,4);
 const replay=await(await post('/api/replay',{sessionId:s.sessionId,evidenceId:s.evidenceRecords[1].id})).json();assert.equal(replay.verified,true);assert.equal(calls,4);
});
test('acceleration settings reject invalid units, durations and unbounded profile parameters before calls',async t=>{
 const {post}=await running(t);const startMotion={...claimStart,problemId:'acceleration'};
 for(const motion of [{speedMph:1000},{speedMph:'60'},{duration:0},{duration:4},{profileB:'eval'},{extra:1},null,[]])assert.equal((await post('/api/session',{...startMotion,motion})).status,400);
 assert.equal((await post('/api/session',{...startMotion,workflow:'baseline'})).status,400);
});

test('flight HTTP workflow binds settings, reveals after prediction, and completes relevant numeric transfer',async t=>{
 let calls=0;const {post,origin,cookie}=await running(t,async req=>{
  calls++;const i=JSON.parse(req.input),text=i.explanation;
  if(i.phase==='claim')return native(claimDecision('propose_claim',text,{kind:'landing-impulse',scope:'ideal-flight-and-contact',interpretation:text,experimentId:'flight-contact'}));
  if(i.phase==='prediction')return native(claimDecision('run_experiment',text,{experimentId:'flight-contact'}));
  if(i.phase==='revision')return native(claimDecision('select_transfer',text,{variantId:'alternate',evidenceIds:[i.evidenceRecords[0].id]}));
  return native(claimDecision('compare_reasoning',text,{priorEvidence:i.originalExplanation,evidenceIds:[i.evidenceRecords[0].id]}));
 });
 let response=await post('/api/session',{...claimStart,problemId:'flight',flight:{airtime:2,massKg:2800,stopTime:.15}});
 assert.equal(response.status,200);let s=await response.json();assert.equal(s.graph,null);
 const turn=async(explanation,answer)=>{const r=await post('/api/turn',{sessionId:s.sessionId,explanation,...(answer?{answer}:{})});assert.equal(r.status,200);s=await r.json();};
 await turn('Longer stopping time lowers average force.');s=await(await post('/api/claim',{sessionId:s.sessionId,claimId:s.claim.id,decision:'confirm'})).json();
 await turn('I predict lower average force and more stopping travel.');assert.equal(s.graph.kind,'flight');assert.equal(s.graph.scenario.massKg,2800);
 await turn('The net impulse is mU; contact force includes weight and peak depends on the chosen profile.');assert.equal(s.graph,null);
 await turn('Average contact force includes mg and the pulse peak is higher. This does not establish safety.',{averageContactForce:22064.96,peakContactForce:34323.28});
 assert.equal(s.report.outcome,'independent');assert.equal(calls,4);
 assert.equal((await(await post('/api/replay',{sessionId:s.sessionId,evidenceId:s.evidenceRecords[1].id})).json()).verified,true);
});
test('flight HTTP rejects malformed physics and baseline mode without model calls',async t=>{
 let calls=0;const {post}=await running(t,async()=>{calls++;throw new Error('unexpected');});
 const config={...claimStart,problemId:'flight'};
 for(const flight of [null,[],{airtime:0},{stopTime:0},{massKg:'2000'},{radius:Infinity},{separation:0},{landingProfile:'unknown'},{extra:1}])assert.equal((await post('/api/session',{...config,flight})).status,400);
 assert.equal((await post('/api/session',{...config,workflow:'baseline'})).status,400);assert.equal(calls,0);
});
