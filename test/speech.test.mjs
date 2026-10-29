import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {makeWav,readWav,readWavBase64,MAX_WAV_BASE64} from '../src/wav.mjs';
import {transcribeMetaAudio} from '../src/meta.mjs';

test('readWav accepts mono 16-bit PCM at 16/24 kHz within a minute and refuses the rest',()=>{
 assert.deepEqual(readWav(makeWav({durationMs:1500})),{sampleRate:16000,durationMs:1500,bytes:44+48000});
 assert.equal(readWav(makeWav({sampleRate:24000,durationMs:60000})).durationMs,60000);
 assert.throws(()=>readWav(makeWav({durationMs:60001})),/longer than one minute/);
 assert.throws(()=>readWav(makeWav({durationMs:200})),/too short/);
 assert.throws(()=>readWav(makeWav({sampleRate:44100})),/16 kHz or 24 kHz/);
 const stereo=makeWav();stereo.writeUInt16LE(2,22);assert.throws(()=>readWav(stereo),/mono 16-bit/);
 const notWav=Buffer.from(makeWav());notWav.write('RIFX',0);assert.throws(()=>readWav(notWav),/RIFF/);
 const truncated=makeWav().subarray(0,1000);assert.throws(()=>readWav(truncated),/past the end/);
 assert.throws(()=>readWav(Buffer.alloc(10)),/header/);
 assert.throws(()=>readWavBase64('not base64!'),/base64/);
 assert.throws(()=>readWavBase64('A'.repeat(MAX_WAV_BASE64+1)),/base64/);
 const parsed=readWavBase64(makeWav({durationMs:400}).toString('base64'));assert.equal(parsed.durationMs,400);assert.ok(Buffer.isBuffer(parsed.buffer));
});

test('transcribeMetaAudio posts multipart WAV with the model request and reads the transcript',async()=>{
 const events=[];let seen;
 const fetchImpl=async(url,init)=>{seen={url,init};return {ok:true,status:200,json:async()=>({sessionId:'s',transcript:'  The cached copy   skips the network. ',audioDurationMs:1830.4,turns:[]})};};
 const wav=makeWav({durationMs:1800,tone:440});
 const result=await transcribeMetaAudio({apiKey:'k',wav,languageBias:['English'],fetchImpl,onTrace:e=>events.push(e)});
 assert.deepEqual(result,{text:'The cached copy skips the network.',model:'muse-voice-transcribe-1.0',audioDurationMs:1830});
 assert.equal(seen.url,'https://api.meta.ai/v1/asr/transcribe');assert.equal(seen.init.headers.Authorization,'Bearer k');assert.equal(seen.init.headers.Accept,'application/json');assert.equal(seen.init.headers['Content-Type'],undefined);
 assert.ok(seen.init.body instanceof FormData);
 const request=JSON.parse(await seen.init.body.get('request').text());assert.deepEqual(request,{model:'muse-voice-transcribe-1.0',mode:'PUSH_TO_TALK',audioEncoding:'WAV',languageBias:['English']});
 const audio=seen.init.body.get('audio');assert.equal(audio.name,'speech.wav');assert.equal(audio.size,wav.byteLength);assert.equal(audio.type,'audio/wav');
 assert.deepEqual(events.map(e=>e.type),['request','response']);assert.equal(events[0].body.audioBytes,wav.byteLength);assert.ok(!JSON.stringify(events).includes(wav.toString('base64').slice(0,20)));
 await assert.rejects(()=>transcribeMetaAudio({apiKey:'k',wav,fetchImpl:async()=>({ok:false,status:413})}),/status 413/);
 await assert.rejects(()=>transcribeMetaAudio({apiKey:'k',wav,fetchImpl:async()=>({ok:true,json:async()=>({})})}),/no transcript/);
 await assert.rejects(()=>transcribeMetaAudio({apiKey:'k',wav,languageBias:['<script>']}),/language names/);
 await assert.rejects(()=>transcribeMetaAudio({apiKey:'',wav}),/MODEL_API_KEY/);
});

async function setup(t,transcribeCall){
 const server=createApp({testerCredentials,configured:true,traceEnabled:true,transcribeCall,modelCall:async()=>{throw new Error('no model call expected');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const status=await(await fetch(origin+'/api/status',{headers:{Cookie:cookie}})).json();
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'})).json();
 return {post,status,sessionId:s.sessionId};
}

test('the transcribe route validates the WAV, keeps lesson attempts, traces without audio and reports failures',async t=>{
 const calls=[];
 const {post,status,sessionId}=await setup(t,async args=>{calls.push(args);args.onTrace?.({type:'request',body:{audioBytes:args.wav.byteLength}});if(calls.length>1)throw new Error('ASR down 500 for key '+testerCredentials.password);return {text:'The water cools faster at first.',model:'muse-voice-transcribe-1.0',audioDurationMs:2000};});
 assert.equal(status.voice,true);
 const wav=makeWav({durationMs:2000,tone:220}).toString('base64');
 assert.equal((await post('/api/studio/transcribe',{sessionId,language:'en',audio:'xyz'})).status,400);
 assert.equal((await post('/api/studio/transcribe',{sessionId,language:'fr',audio:wav})).status,400);
 assert.equal((await post('/api/studio/transcribe',{sessionId,language:'en',audio:makeWav({durationMs:61000}).toString('base64')})).status,400);
 assert.equal(calls.length,0);
 const ok=await post('/api/studio/transcribe',{sessionId,language:'zh',audio:wav});
 assert.equal(ok.status,200);const reply=await ok.json();
 assert.equal(reply.text,'The water cools faster at first.');assert.equal(reply.model,'muse-voice-transcribe-1.0');assert.equal(reply.audioDurationMs,2000);assert.equal(reply.attemptsRemaining,8);assert.equal(typeof reply.elapsedMs,'number');
 assert.equal(calls.length,1);assert.deepEqual(calls[0].languageBias,['Chinese']);assert.equal(calls[0].timeoutMs,30000);assert.ok(Buffer.isBuffer(calls[0].wav));
 const failed=await post('/api/studio/transcribe',{sessionId,language:'en',audio:wav});
 assert.equal(failed.status,502);const body=await failed.json();assert.match(body.error,/could not be transcribed/);assert.ok(!JSON.stringify(body).includes('500'));assert.ok(!JSON.stringify(body).includes(testerCredentials.password));
 const trace=await(await post('/api/trace',{sessionId})).json();
 const rows=trace.records.filter(r=>r.model==='muse-voice-transcribe-1.0');
 assert.equal(rows.length,2);assert.equal(rows[0].outcome,'accepted');assert.equal(rows[1].outcome,'failed or rejected');
 const text=JSON.stringify(trace);assert.ok(!text.includes(wav.slice(0,24)));assert.ok(!text.includes(testerCredentials.password));assert.equal(rows[0].request.audioBytes,44+64000);assert.equal(rows[0].response,null);
});

test('the transcribe route is 503 and status hides the microphone when no key is configured',async t=>{
 const {post,status,sessionId}=await setup(t,null);
 assert.equal(status.voice,false);
 assert.equal((await post('/api/studio/transcribe',{sessionId,language:'en',audio:makeWav().toString('base64')})).status,503);
});
