import assert from 'node:assert/strict';
import { test } from 'node:test';
import { request } from 'node:http';
import { createApp } from '../src/server.mjs';
import { testerCredentials, testerCookie } from '../test-support/tester.mjs';

// Boots the app on a free local port with a scripted model and signs the tester in. The
// returned `post` sends JSON with the tester cookie and a same-origin header, as the page would.
async function running(t, model) {
  const server = createApp({ testerCredentials, configured: true, modelCall: model });
  await new Promise(ready => server.listen(0, '127.0.0.1', ready));
  t.after(() => new Promise(done => server.close(done)));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const cookie = await testerCookie(origin);
  const post = (path, body, headers = {}) => fetch(origin + path, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const statusOf = async (path, body, headers) => (await post(path, body, headers)).status;
  return { origin, post, cookie, statusOf };
}
const start = { problemId: 'crossing', language: 'en', synthetic: true };
// A scripted model: one clarification that quotes the learner's words back as evidence.
function clarification(text, feedback = 'Clarify.', question = 'Which end?') {
  const args = { assessment: 'ambiguous', evidence: text, feedback, question, reason: 'Clarify the meaning before judging.', focus: 'meaning' };
  return { model: 'test', toolCall: { name: 'ask_clarification', arguments: JSON.stringify(args) } };
}
const echoing = (...rest) => async args => clarification(JSON.parse(args.input).explanation, ...rest);
// Sends a raw request (body chunks optional; a second chunk goes out after a short pause) and
// resolves with the status code, for cases fetch() would normalise away.
function raw(origin, path, { method = 'GET', headers = {}, chunks = [] } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(origin + path, { method, headers }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    const [first, second] = chunks;
    if (first) req.write(first);
    if (second) setTimeout(() => req.end(second), 5); else req.end();
  });
}
const untilReleased = async get => { while (!get()) await new Promise(tick => setTimeout(tick, 1)); };
// A model that parks until the test releases it, so a second request can arrive meanwhile.
function parked(reply) {
  const gate = { release: null };
  gate.model = async args => { await new Promise(open => { gate.release = open; }); return reply(args); };
  gate.wait = () => untilReleased(() => gate.release);
  return gate;
}

test('the built page is served with a strict CSP; repository and environment files are not', async t => {
  const app = await running(t);
  const page = await fetch(app.origin);
  // dist/ may be absent in a bare checkout; either way no source file is reachable.
  assert.ok([200, 404].includes(page.status));
  if (page.status === 200) assert.match(await page.text(), /ExplainBack/);
  assert.match(page.headers.get('content-security-policy') ?? '', /default-src 'self'/);
  const privatePaths = ['/.env.local', '/src/meta.mjs', '/package.json', '/docs/', '/assets/../.env.local'];
  for (const path of privatePaths) assert.equal((await fetch(app.origin + path)).status, 404, path);
});

test('the old module shell is gone and source stays private, while the auth route answers', async t => {
  const app = await running(t);
  const gone = ['/assets/app.mjs', '/assets/lesson-studio.mjs', '/assets/lesson-schema.mjs', '/frontend/App.tsx', '/public/gallery-lessons.mjs'];
  for (const path of gone) assert.equal((await fetch(app.origin + path)).status, 404, path);
  assert.equal((await fetch(app.origin + '/api/auth')).status, 200, 'the auth route answers');
});

test('foreign origins, non-synthetic sessions, prototype keys and foreign hosts are refused', async t => {
  const { origin, statusOf } = await running(t);
  assert.equal(await statusOf('/api/session', start, { Origin: 'https://example.com' }), 403, 'foreign origin');
  assert.equal(await statusOf('/api/session', { ...start, synthetic: false }), 400, 'synthetic flag required');
  assert.equal(await statusOf('/api/session', { ...start, problemId: '__proto__' }), 400, 'prototype key');
  assert.equal(await raw(origin, '/api/status', { headers: { Host: 'example.com' } }), 403, 'foreign host header');
});

test('a reset while a turn is in flight discards the late result', async t => {
  const gate = parked(echoing());
  const { post } = await running(t, gate.model);
  const { sessionId } = await (await post('/api/session', start)).json();
  const late = post('/api/turn', { sessionId, explanation: 'synthetic explanation' });
  await gate.wait();
  await post('/api/reset', { sessionId });
  gate.release();
  assert.equal((await late).status, 409);
});

test('a turn carries the learner\'s words through the adapter and back, and a reset ends the session', async t => {
  const { post } = await running(t, echoing('Please distinguish finite inputs from end behavior.', 'What does never mean here?'));
  const { sessionId } = await (await post('/api/session', start)).json();
  const turn = await post('/api/turn', { sessionId, explanation: 'never touches' });
  const body = await turn.json();
  assert.deepEqual(
    [turn.status, body.phase, body.history[0].assessment, body.history[0].evidence, body.attemptsRemaining],
    [200, 'explain', 'ambiguous', 'never touches', 11],
  );
  assert.equal((await post('/api/reset', { sessionId })).status, 200);
  assert.equal((await post('/api/turn', { sessionId, explanation: 'hello' })).status, 404);
});

test('an adapter failure is a safe 502 that counts the turn but changes no state', async t => {
  const { post } = await running(t, async () => { throw new Error('test-secret must stay on the server'); });
  const { sessionId } = await (await post('/api/session', start)).json();
  const failed = await post('/api/turn', { sessionId, explanation: 'I think it never touches.' });
  const text = await failed.text();
  assert.equal(failed.status, 502, text);
  assert.doesNotMatch(text, /test-secret/);
  assert.equal(JSON.parse(text).attemptsRemaining, 11);
});

test('a Chinese character split across two TCP writes arrives intact', async t => {
  let heard;
  const { origin, post, cookie } = await running(t, async args => {
    heard = JSON.parse(args.input).explanation;
    return clarification(heard, '请澄清。', '指哪一端？');
  });
  const { sessionId } = await (await post('/api/session', { ...start, language: 'zh' })).json();
  const bytes = Buffer.from(JSON.stringify({ sessionId, explanation: '不会碰到' }));
  const cut = bytes.indexOf(Buffer.from('不')) + 1; // inside the first multibyte character
  const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' };
  assert.equal(await raw(origin, '/api/turn', { method: 'POST', headers, chunks: [bytes.subarray(0, cut), bytes.subarray(cut)] }), 200);
  assert.equal(heard, '不会碰到');
});

test('oversized bodies are refused and the twelve-turn cap holds', async t => {
  let calls = 0;
  const { post, statusOf } = await running(t, async args => { calls++; return clarification(JSON.parse(args.input).explanation); });
  assert.equal(await statusOf('/api/session', { ...start, padding: 'x'.repeat(17000) }), 413, 'body cap');
  const { sessionId } = await (await post('/api/session', start)).json();
  for (let turn = 1; turn <= 12; turn++) assert.equal((await post('/api/turn', { sessionId, explanation: 'never' })).status, 200, `turn ${turn}`);
  assert.equal((await post('/api/turn', { sessionId, explanation: 'never' })).status, 429);
  assert.equal(calls, 12, 'one model call per accepted turn');
});

test('over-long explanations and concurrent duplicates never reach the model more than once', async t => {
  let calls = 0;
  const gate = parked(args => clarification(JSON.parse(args.input).explanation));
  const { post } = await running(t, async args => { calls++; return gate.model(args); });
  const { sessionId } = await (await post('/api/session', start)).json();
  assert.equal((await post('/api/turn', { sessionId, explanation: 'x'.repeat(1201) })).status, 400);
  assert.equal(calls, 0, 'refused before the model');
  const first = post('/api/turn', { sessionId, explanation: 'never' });
  await gate.wait();
  assert.equal((await post('/api/turn', { sessionId, explanation: 'never' })).status, 409);
  gate.release();
  assert.equal((await first).status, 200, 'the first request completes');
  assert.equal(calls, 1, 'the duplicate never reached the model');
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
