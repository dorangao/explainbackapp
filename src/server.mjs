import express from 'express';
import {quantumCoachRequest,readQuantumCoach} from './quantum-coach.mjs';
import {lessonAuthorRequest,readLessonAuthor} from './lesson-author.mjs';
import {learnerTryoutRequest,readLearnerTryout} from './lesson-tester.mjs';
import {showRequest,readShow,illustrationPrompt} from './lesson-show.mjs';
import {generateMetaImage,transcribeMetaAudio,segmentMetaImage,validConcept} from './meta.mjs';
import {IMAGE_DATA_URL,MAX_IMAGE_CHARS} from './lesson-author.mjs';
import {validateLesson} from '../public/lesson-schema.mjs';
import {suctionScenario,suctionTitle} from '../public/suction.mjs';
import {flightScenario,flightTitle} from '../public/flight.mjs';
import {createTesterAuth,expiredTesterCookie} from './tester-auth.mjs';
import {parseAccessCodes,budgetFor,publicAudience} from './access-codes.mjs';
import {createTrace} from './trace.mjs';
import {buildSavedLesson,attachImages,validateShowScript,lessonSummary,publicLesson,validLessonId,MAX_SAVED_PER_OWNER,MAX_SHARED_LISTED} from './lessons.mjs';
import {createBlobStore,decodeImageDataUrl,recordImageUrls} from './blob.mjs';
import {createMemoryState} from './state.mjs';
import { createServer } from 'node:http';
import {serveFrontend} from './static.mjs';
import {readWavBase64} from './wav.mjs';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {createProviderRouter} from './llm/index.mjs';
import { createSession, assess, advance, view } from './learning.mjs';
import { problems } from './problems.mjs';
import { confirmClaim, replayClaimEvidence } from './claim-testing.mjs';
import { answerShapeValid } from './claim-domains.mjs';
import { motionScenario, motionTitle } from '../public/motion.mjs';

// The React build in dist/ is the only page; legacy module serving was removed with the old shell.
export const safeHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data: https://*.public.blob.vercel-storage.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }

function localOrigin(req){
  const port=req.socket.localPort;
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host))throw new RequestError(403,'Only local requests are accepted.');
  return `http://${req.headers.host}`;
}
export function createHandler({
  configured, modelCall, router = createProviderRouter(),
  // Cover illustrations for shows; null disables them. Tests inject a fake.
  imageCall = process.env.MODEL_API_KEY?.trim()?(args=>generateMetaImage({apiKey:process.env.MODEL_API_KEY,...args})):null,
  // Speech to text for the spoken explain-back; null hides the microphone. Tests inject a fake.
  transcribeCall = process.env.MODEL_API_KEY?.trim()?(args=>transcribeMetaAudio({apiKey:process.env.MODEL_API_KEY,...args})):null,
  // Vercel Blob for image bytes (covers, illustrations, sketches); null keeps images in the
  // browser only. Tests inject a fake.
  imageStore = createBlobStore(),
  // SAM 3.1 finds the object a creator names in their sketch or photo; null hides it.
  segmentCall = process.env.MODEL_API_KEY?.trim()?(args=>segmentMetaImage({apiKey:process.env.MODEL_API_KEY,...args})):null,
  traceEnabled = process.env.EXPLAINBACK_TRACE === '1',
  testerCredentials = {},accessCodes=parseAccessCodes(process.env.EXPLAINBACK_ACCESS_CODES),openAccess=process.env.EXPLAINBACK_OPEN_ACCESS==='1',
  state=createMemoryState(),auth=createTesterAuth({...testerCredentials,accessCodes:accessCodes.codes??accessCodes,onRevoke:owner=>state.revokeOwner(owner)}),getOrigin=localOrigin,
  // The visitor address that failed sign-ins are counted against. Locally it is the
  // socket peer; the cloud handler reads the platform's own header instead.
  clientAddress=req=>req.socket?.remoteAddress??'',
} = {}) {
  const codes=accessCodes.codes??accessCodes;
  // Local development only: EXPLAINBACK_OPEN_ACCESS=1 treats every request as one shared
  // signed-in tester. The cloud handler passes openAccess:false, so it cannot apply on Vercel.
  const OPEN_ID='local-open-access';
  const access=openAccess?{...auth,async authenticate(cookie){return await auth.authenticate(cookie)??{id:OPEN_ID,audience:null};},async active(id){return id===OPEN_ID||await auth.active(id);}}:auth;
  // Configuration problems are reported by position only; code values never reach logs.
  for(const warning of accessCodes.warnings??[])console.warn('EXPLAINBACK_ACCESS_CODES '+warning);
  const redacted=[process.env.MODEL_API_KEY?.trim(),testerCredentials.password??process.env.EXPLAINBACK_TESTER_PASSWORD,...codes.map(c=>c.code)];
  // Why a provider reply was rejected: only our own reader/validator messages (tagged where the
  // reply is read), one line, bounded, configured secrets removed. Provider and transport errors
  // carry no reason: their text is never returned to the browser.
  const tagRejection=error=>{const e=error instanceof SyntaxError?new Error('Provider reply was not valid JSON.'):error;if(e&&typeof e==='object')e.rejection=true;return e;};
  const rejectionReason=error=>{if(error?.rejection!==true||typeof error.message!=='string')return null;const text=error.message.replace(/\s+/g,' ').trim().slice(0,200);return redacted.filter(Boolean).reduce((t,key)=>t.split(key).join('[REDACTED]'),text)||null;};
  const targets=router.list().map(t=>({...t,...(configured!==undefined&&t.id===router.defaultId?{configured}:{})}));
  const selected=id=>{const t=targets.find(t=>t.id===(id??router.defaultId));if(!t)throw new RequestError(400,'Choose an allowed provider/model.');return {...t};};
  const defaultTarget=selected();
  // A hosted function has 60 s in all (vercel.json maxDuration). The show's cover call gets
  // what is left after the script call, and is skipped when that is too little to succeed.
  const REQUEST_BUDGET_MS=55_000,MIN_IMAGE_MS=8_000;
  const imageBudgetMs=elapsedMs=>{const left=REQUEST_BUDGET_MS-elapsedMs;return left>=MIN_IMAGE_MS?Math.min(60_000,Math.round(left)):0;};
  // A drawn image goes to Blob storage under its creator when configured, so the browser
  // gets a short URL that a saved lesson can keep; otherwise the data URL as before.
  const storeImage=async(image,owner)=>{if(!imageStore)return image.dataUrl;try{return await imageStore.putImage({owner,...decodeImageDataUrl(image.dataUrl)});}catch{return image.dataUrl;}};
  // Roles: the stronger Wonder model drafts and revises; Spark plays the first-time learner
  // who tries a draft and reports back. Each falls back to the default target when absent.
  const roleTarget=prefix=>targets.find(t=>t.configured&&t.provider==='meta'&&t.model.startsWith(prefix))??defaultTarget;
  const roles={creator:roleTarget('muse-wonder').id,tester:roleTarget('muse-spark').id};
  const sessionView=s=>({...view(s),llm:s.llm});
  const app = express();
  app.disable('x-powered-by');
  app.enable('case sensitive routing');
  app.enable('strict routing');
  const reply = (res, status, data, headers = {}) => res.status(status).set(headers).json(data);
  // Track async middleware until its work, including lock cleanup, has settled.
  // A serverless invocation can observe response completion before an async
  // route's finally block finishes. The adapter waits for this shared set.
  const tracked = fn => (req,res,next) => {
    const pending = res.explainPendingTasks ??= new Set();
    const task = Promise.resolve().then(() => fn(req,res,next));
    pending.add(task);
    task.then(() => pending.delete(task), error => {pending.delete(task);next(error);});
  };
  const requireOrigin = (req, res, next) => {
    if (req.headers.origin !== res.locals.origin) return next(new RequestError(403, 'This action must come from this app.'));
    next();
  };
  const bodyLimit = path => ['/api/studio/compose','/api/studio/detect'].includes(path) ? 1_400_000 : path === '/api/lessons' ? 3_000_000 : path === '/api/studio/transcribe' ? 2_700_000 : ['/api/studio/guide','/api/studio/tryout','/api/studio/show','/api/studio/illustrate'].includes(path) ? 48_000 : 16_384;
  const parseBody = (req, res, next) => {
    if (!req.headers['content-type']?.startsWith('application/json')) return next(new RequestError(415, 'Use JSON for this request.'));
    if (req.headers['content-encoding'] && req.headers['content-encoding'].toLowerCase() !== 'identity') return next(new RequestError(415, 'Compressed request encoding is not supported.'));
    const limit = bodyLimit(req.path);
    const validate = error => {
      if (error) return next(error);
      try {
        if (typeof req.body === 'string') {
          if (Buffer.byteLength(req.body) > limit) throw new RequestError(413, 'Request is too large.');
          req.body = JSON.parse(req.body);
        } else if (req.body !== undefined && Buffer.byteLength(JSON.stringify(req.body)) > limit) throw new RequestError(413, 'Request is too large.');
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new RequestError(400, 'Invalid JSON request.');
        next();
      } catch (error) { next(error instanceof RequestError ? error : new RequestError(400, 'Invalid JSON request.')); }
    };
    if (req.body !== undefined) return validate();
    return express.json({limit, strict:true, inflate:false})(req,res,validate);
  };
  app.use(tracked(async (req, res, next) => {
    res.set(safeHeaders);
    const origin = getOrigin(req);
    if (!origin) throw new RequestError(403, 'This host is not allowed.');
    res.locals.origin = origin;
    if (!req.path.startsWith('/api/') && await serveFrontend(req,res,safeHeaders)) return;
    res.locals.tester = await access.authenticate(req.headers.cookie);
    next();
  }));
  app.get('/api/auth', (req,res) => reply(res,200,{configured:access.configured,codes:access.codesConfigured===true,open:openAccess,authenticated:Boolean(res.locals.tester)}));
  app.post(['/api/login','/api/logout'], requireOrigin, parseBody, tracked(async (req,res,next) => {
    if(req.path==='/api/logout'){await access.revoke(req.headers.cookie);return reply(res,200,{authenticated:false},{'Set-Cookie':access.expiredCookie??expiredTesterCookie});}
    try { const result=await access.login(req.body,req.headers.cookie,{client:clientAddress(req)}); return reply(res,200,{authenticated:true},{'Set-Cookie':result.cookie}); }
    catch(error){ if(!error.status)return next(error);return reply(res,error.status,{error:error.message,code:error.code}); }
  }));
  // Shared lessons open without signing in, like the gallery. Ids are unguessable.
  app.get('/api/shared', tracked(async (req,res) => reply(res,200,{lessons:(await state.listSharedLessons(MAX_SHARED_LISTED)).map(lessonSummary)})));
  app.get('/api/shared/:id', tracked(async (req,res) => {
    const record=validLessonId(req.params.id)?await state.getLesson(req.params.id):null;
    if(!record||record.shared!==true)return reply(res,404,{error:'This shared lesson is not available.'});
    reply(res,200,publicLesson(record));
  }));
  app.use((req,res,next) => {
    if(req.path.startsWith('/api/')&&!res.locals.tester)return reply(res,401,{error:'Sign in to tester access.',code:'TESTER_REQUIRED'});
    next();
  });
  // A creator's saved lessons. Reviewer invites own their lessons by label, so the same
  // invite sees them again after signing in from another browser; the tester account
  // shares one shelf. Saving makes no model request.
  const ownerOf=tester=>tester.audience?.label?`code:${tester.audience.label}`:tester.id===OPEN_ID?'local':'tester';
  app.get('/api/lessons', tracked(async (req,res) => reply(res,200,{lessons:(await state.listLessons(ownerOf(res.locals.tester))).map(lessonSummary),limit:MAX_SAVED_PER_OWNER})));
  app.get('/api/lessons/:id', tracked(async (req,res) => {
    const record=validLessonId(req.params.id)?await state.getLesson(req.params.id):null;
    if(!record||record.owner!==ownerOf(res.locals.tester))return reply(res,404,{error:'Saved lesson not found.'});
    reply(res,200,publicLesson(record));
  }));
  app.post(['/api/lessons','/api/lessons/share','/api/lessons/delete'], requireOrigin, parseBody, tracked(async (req,res) => {
    const owner=ownerOf(res.locals.tester),body=req.body;
    if(!await access.active(res.locals.tester.id))return reply(res,401,{error:'Sign in to tester access.',code:'TESTER_REQUIRED'});
    const own=async()=>{const record=validLessonId(body.id)?await state.getLesson(body.id):null;if(!record||record.owner!==owner)throw new RequestError(404,'Saved lesson not found.');return record;};
    if(req.path==='/api/lessons/delete'){const record=await own();await state.deleteLesson(owner,body.id);await imageStore?.remove(recordImageUrls(record));return reply(res,200,{deleted:true,id:body.id});}
    if(req.path==='/api/lessons/share'){
      if(typeof body.shared!=='boolean')throw new RequestError(400,'Use a boolean shared flag.');
      const record={...await own(),shared:body.shared,updatedAt:Date.now()};
      if(!await state.putLesson(record,MAX_SAVED_PER_OWNER))throw new RequestError(409,'Could not update this lesson.');
      return reply(res,200,lessonSummary(record));
    }
    const previous=body.id!==undefined?await own():null;
    let record;try{record=buildSavedLesson(body,{owner,previous});}catch{throw new RequestError(400,'Save a valid bilingual lesson, with optional show script, tryout report and grades.');}
    // Images: kept when already stored under this creator, uploaded from data URLs when
    // Blob storage exists, dropped otherwise. Uploads happen before the cap check, so a
    // refused save removes what it uploaded.
    let stale;try{stale=await attachImages(record,body,{store:imageStore,owner,previous});}catch{throw new RequestError(400,'Images must be the show cover, slide illustrations or the source sketch, each under 1.5 MB.');}
    if(!await state.putLesson(record,MAX_SAVED_PER_OWNER)){await imageStore?.remove(recordImageUrls(record).filter(url=>!recordImageUrls(previous).includes(url)));throw new RequestError(409,`You can keep up to ${MAX_SAVED_PER_OWNER} saved lessons. Delete one to save another.`);}
    await imageStore?.remove(stale);
    reply(res,200,lessonSummary(record));
  }));
  app.get('/api/status', tracked(async (req,res) => {
    const tester=res.locals.tester; const [bucket,limit]=budgetFor(tester?.audience);
    const audience=tester.audience?{...publicAudience(tester.audience),remaining:await state.remainingTurns(bucket,limit)}:null;
    reply(res,200,{configured:defaultTarget.configured,mode:'live',access:audience,model:defaultTarget.model,models:targets,defaultModel:defaultTarget.id,roles,voice:Boolean(transcribeCall),images:Boolean(imageCall),imageStorage:Boolean(imageStore),detect:Boolean(segmentCall),traceEnabled,audience:'tester-poc',problems:[...Object.values(problems).map(p=>({id:p.id,title:p.title})),{id:'acceleration',title:motionTitle},{id:'flight',title:flightTitle},{id:'suction',title:suctionTitle}]});
  }));
  const actions=['/api/studio/session','/api/studio/compose','/api/studio/poll','/api/studio/guide','/api/studio/tryout','/api/studio/show','/api/studio/illustrate','/api/studio/detect','/api/studio/transcribe','/api/quantum/session','/api/quantum/explain','/api/session','/api/turn','/api/reset','/api/claim','/api/replay',...(traceEnabled?['/api/trace']:[])];
  app.post(actions, requireOrigin, parseBody, tracked(async (req,res) => {
    let lockedId,lock;
    const json = (status,data,headers={}) => reply(res,status,data,headers);
    const tester=res.locals.tester, body=req.body, path=req.path;
    const [bucket,limit]=budgetFor(tester?.audience);
    const quotaExceeded=()=>new RequestError(429,tester?.audience?'This access code’s hourly request budget is used up. Reviewed lessons still open without live requests.':'API request limit reached. No request was sent.');
    try {
      if(!await access.active(tester.id)){json(401,{error:'Sign in to tester access.',code:'TESTER_REQUIRED'});return;}
      if(path==='/api/quantum/session'||path==='/api/studio/session'){
        if(body.synthetic!==true||!['en','zh'].includes(body.language))throw new RequestError(400,'Choose a language and synthetic quantum demo.');
        const target=selected(body.llm);if(!target.configured)throw new RequestError(503,'Selected provider is not configured.');
        const sessionId=randomBytes(24).toString('hex');
        const s={workflow:path==='/api/studio/session'?'lesson-studio':'quantum-showcase',language:body.language,llm:target,owner:tester.id,audience:tester.audience?.label??null,createdAt:Date.now(),attempts:0};
        if(!await state.create(sessionId,s))throw new RequestError(429,'Session limit reached.');
        json(200,{sessionId,llm:target,attemptsRemaining:8});return;
      }
      if (path === '/api/session') {
        if (body.synthetic !== true) throw new RequestError(400, 'Use synthetic examples for this prototype.');
        if ((!Object.hasOwn(problems, body.problemId)&&!['acceleration','flight','suction'].includes(body.problemId)) || !['en', 'zh'].includes(body.language)) throw new RequestError(400, 'Choose a problem and language.');
        const workflow=body.workflow??(['acceleration','flight','suction'].includes(body.problemId)?'claim-testing':'baseline');
        if(!['baseline','claim-testing'].includes(workflow)||(workflow==='claim-testing'&&!['crossing','acceleration','flight','suction'].includes(body.problemId))||(['acceleration','flight','suction'].includes(body.problemId)&&workflow!=='claim-testing')) throw new RequestError(400,'Choose an available workflow.');
        if(body.problemId==='acceleration')try{motionScenario(body.motion===undefined?{}:body.motion);}catch{throw new RequestError(400,'Choose allowed hypothetical motion, mass, grip and power settings.');}
        if(body.problemId==='suction')try{suctionScenario(body.suction===undefined?{}:body.suction);}catch{throw new RequestError(400,'Choose allowed hypothetical suction settings.');}
        if(body.problemId==='flight')try{flightScenario(body.flight===undefined?{}:body.flight);}catch{throw new RequestError(400,'Choose allowed hypothetical flight, inertia and stopping settings.');}
        const target=selected(body.llm);
        if(!target.configured)throw new RequestError(503,'Selected provider is not configured. Check the server environment.');
        const s = createSession(body.problemId, body.language, workflow,body.problemId==='suction'?(body.suction??{}):body.problemId==='flight'?(body.flight??{}):body.problemId==='acceleration'?(body.motion??{}):{});
        const sessionId = randomBytes(24).toString('hex');
        s.llm=target;s.owner=tester.id;s.audience=tester.audience?.label??null;
        s.demoUsed=traceEnabled;
        if(!await state.create(sessionId,s))throw new RequestError(429,'Session limit reached. Reset an existing session.');
        json(200, { sessionId, ...sessionView(s) }); return;
      }
      if(typeof body.sessionId!=='string'||!/^[a-f0-9]{48}$/.test(body.sessionId))throw new RequestError(404,'Session expired. Start a new session.');
      let s = await state.get(body.sessionId);
      if (!s || s.owner!==tester.id) throw new RequestError(404, 'Session expired. Start a new session.');
      if (path === '/api/reset') { await state.remove(body.sessionId); json(200, { reset: true }); return; }
      if(path!=='/api/trace'||body.clear===true){
        lockedId=body.sessionId;lock=await state.acquire(lockedId);
        if(!lock)throw new RequestError(409,'A response is already in progress.');
        s=await state.get(lockedId);
        if(!s||s.owner!==tester.id)throw new RequestError(404,'Session expired. Start a new session.');
      }
      const save=async rows=>{if(!await state.save(body.sessionId,s,lock,rows))throw new RequestError(409,'Session was reset or expired; the response was discarded.');};
      if(s.workflow==='lesson-studio'&&path==='/api/studio/poll'){
        if(!s.background)throw new RequestError(404,'No background lesson is available.');
        if(s.background.result){json(200,s.background.result);return;}
        let raw;try{raw=await router.pollBackground(s.llm.id,s.background.id);}catch{throw new RequestError(502,'Could not retrieve the background lesson. Try again.');}
        if(!await access.active(tester.id))throw new RequestError(401,'Sign in to tester access.');
        if(raw.pending){json(200,{pending:true,attemptsRemaining:8-s.attempts});return;}
        if(raw.failed){delete s.background;await save();const failure=new RequestError(502,'Background lesson failed. Retry explicitly.');failure.code='BACKGROUND_FAILED';failure.attemptsRemaining=8-s.attempts;throw failure;}
        let result;try{result=readLessonAuthor(raw,'compose',s.background.creation);}catch(error){delete s.background;await save();const failure=new RequestError(502,'Provider lesson could not be completed or validated. Retry explicitly.');failure.code='BACKGROUND_FAILED';failure.reason=rejectionReason(tagRejection(error));failure.attemptsRemaining=8-s.attempts;throw failure;}
        const answer={...result,model:raw.model??s.llm.model,elapsedMs:Date.now()-s.background.startedAt,usage:raw.usage?{input:raw.usage.input_tokens??null,output:raw.usage.output_tokens??null}:null,llm:s.llm,attemptsRemaining:8-s.attempts};
        s.background={result:answer};await save();json(200,answer);return;
      }
      if(path==='/api/trace'){
        if(body.clear!==undefined&&typeof body.clear!=='boolean')throw new RequestError(400,'Use a boolean clear flag.');
        if(body.clear)await state.writeTrace(body.sessionId,[],lock);json(200,{records:await state.readTrace(body.sessionId)});return;
      }
      if(s.workflow==='lesson-studio'&&path==='/api/studio/transcribe'){
        // The learner's spoken explanation becomes editable text; it counts against the hourly
        // budget but not the eight lesson attempts. Audio bytes never reach the trace or logs.
        if(!transcribeCall)throw new RequestError(503,'Voice transcription is not configured.');
        if(!['en','zh'].includes(body.language))throw new RequestError(400,'Choose a language.');
        let wav;try{wav=readWavBase64(body.audio);}catch{throw new RequestError(400,'Record up to one minute of speech as mono 16-bit WAV.');}
        if(!await state.consumeTurn(bucket,limit))throw quotaExceeded();
        const trace=traceEnabled?createTrace(redacted,{initial:await state.readTrace(body.sessionId),onChange:rows=>state.writeTrace(body.sessionId,rows,lock)}):null;
        const call=trace?.start({provider:'meta',model:'muse-voice-transcribe-1.0',input:`spoken explanation, ${wav.durationMs} ms at ${wav.sampleRate} Hz`,instructions:'speech to text'});
        try{
          await trace?.flush();
          const startedAt=performance.now();
          const result=await transcribeCall({wav:wav.buffer,languageBias:[body.language==='zh'?'Chinese':'English'],timeoutMs:30_000,...(call?{onTrace:call.event}:{})});
          if(!await access.active(tester.id)){call?.finish('discarded');await state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
          call?.finish(result.text?'accepted':'empty');try{await trace?.flush();}catch{}
          await save(trace?.read());
          json(200,{text:result.text,model:result.model,audioDurationMs:result.audioDurationMs??wav.durationMs,elapsedMs:Math.round(performance.now()-startedAt),usage:null,attemptsRemaining:8-s.attempts});return;
        }catch(error){
          call?.finish(error instanceof RequestError?'discarded':'failed or rejected');
          if(error instanceof RequestError)throw error;
          const failure=new RequestError(502,'The recording could not be transcribed. Try again or type your explanation.');failure.attemptsRemaining=8-s.attempts;throw failure;
        }finally{try{await trace?.flush();}catch{}}
      }
      if(s.workflow==='lesson-studio'){
        const mode=path==='/api/studio/compose'?'compose':path==='/api/studio/guide'?'guide':path==='/api/studio/tryout'?'tryout':path==='/api/studio/show'?'show':path==='/api/studio/illustrate'?'illustrate':path==='/api/studio/detect'?'detect':null;
        if(!mode)throw new RequestError(400,'Use this session for Lesson Studio only.');
        // SAM 3.1 locates the one thing the creator names in their sketch or photo and
        // returns pixel boxes; it is one request on the budget and never sees the lesson.
        if(mode==='detect'){
          if(!segmentCall)throw new RequestError(503,'The segmentation model is not configured.');
          const concept=typeof body.concept==='string'?body.concept.trim():'';
          if(!validConcept(concept)||typeof body.image!=='string'||body.image.length>MAX_IMAGE_CHARS||!IMAGE_DATA_URL.test(body.image))throw new RequestError(400,'Name one thing in a few words and attach an image.');
          if(s.attempts>=8||!await state.consumeTurn(bucket,limit)){const failure=quotaExceeded();failure.attemptsRemaining=8-s.attempts;throw failure;}
          s.attempts++;await save();
          const trace=traceEnabled?createTrace(redacted,{initial:await state.readTrace(body.sessionId),onChange:rows=>state.writeTrace(body.sessionId,rows,lock)}):null;
          const call=trace?.start({provider:'meta',model:'sam-3.1',input:concept,instructions:'segmentation'});
          try{
            await trace?.flush();
            const startedAt=performance.now();
            const found=await segmentCall({image:body.image,concept,timeoutMs:30_000,...(call?{onTrace:call.event}:{})});
            if(!await access.active(tester.id)){call?.finish('discarded');await state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
            if(!await state.get(body.sessionId))throw new RequestError(409,'Session was reset; response discarded.');
            call?.finish(found.boxes.length?'accepted':'empty');try{await trace?.flush();}catch{}
            await save(trace?.read());
            json(200,{concept,boxes:found.boxes.slice(0,32),width:found.width,height:found.height,model:found.model,elapsedMs:Math.round(performance.now()-startedAt),usage:found.usage?{input:found.usage.input_tokens??null,output:found.usage.output_tokens??null}:null,llm:s.llm,attemptsRemaining:8-s.attempts});return;
          }catch(error){
            call?.finish(error instanceof RequestError?'discarded':'failed or rejected');
            if(error instanceof RequestError)throw error;
            const failure=new RequestError(502,'The image could not be analysed. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;throw failure;
          }finally{try{await trace?.flush();}catch{}}
        }
        // One illustration from Muse Image for a slide of the current show (or a redrawn
        // cover). The prompt is built here from the checked script; it counts as one request.
        if(mode==='illustrate'){
          if(!imageCall)throw new RequestError(503,'The image model is not configured.');
          let prompt,slide=null;
          try{const lesson=validateLesson(body.lesson),script=validateShowScript(body.show,lesson);if(!script)throw new Error();slide=body.slide===undefined?null:body.slide;prompt=illustrationPrompt(script,slide,body.direction??'');}
          catch{throw new RequestError(400,'Send the checked lesson, its show script and a slide to illustrate.');}
          if(s.attempts>=8||!await state.consumeTurn(bucket,limit)){const failure=quotaExceeded();failure.attemptsRemaining=8-s.attempts;throw failure;}
          s.attempts++;await save();
          const trace=traceEnabled?createTrace(redacted,{initial:await state.readTrace(body.sessionId),onChange:rows=>state.writeTrace(body.sessionId,rows,lock)}):null;
          const call=trace?.start({provider:'meta',model:'muse-image-1.0',input:prompt,instructions:'image generation'});
          try{
            await trace?.flush();
            const startedAt=performance.now();
            const image=await imageCall({prompt,timeoutMs:imageBudgetMs(0),...(call?{onTrace:call.event}:{})});
            if(!await access.active(tester.id)){call?.finish('discarded');await state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
            if(!await state.get(body.sessionId))throw new RequestError(409,'Session was reset; response discarded.');
            const url=await storeImage(image,ownerOf(tester));
            call?.finish('accepted');try{await trace?.flush();}catch{}
            await save(trace?.read());
            json(200,{image:url,model:image.model,slide,prompt,elapsedMs:Math.round(performance.now()-startedAt),usage:image.usage?{input:image.usage.input_tokens??null,output:image.usage.output_tokens??null}:null,llm:s.llm,attemptsRemaining:8-s.attempts});return;
          }catch(error){
            call?.finish(error instanceof RequestError?'discarded':'failed or rejected');
            if(error instanceof RequestError)throw error;
            const failure=new RequestError(502,'The illustration could not be drawn. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;throw failure;
          }finally{try{await trace?.flush();}catch{}}
        }
        // Quick learner feedback and the test learner use Spark regardless of the creator model.
        const llm=['tryout','guide'].includes(mode)?selected(roles.tester):s.llm;
        if(!llm.configured)throw new RequestError(503,'The selected model is not configured.');
        let args;try{args=mode==='tryout'?learnerTryoutRequest(body):mode==='show'?showRequest(body):lessonAuthorRequest(body,mode);}catch{throw new RequestError(400,'Use a short topic or a valid lesson and experiment.');}
        const background=mode==='compose'&&body.background===true&&s.llm.provider==='meta'&&s.llm.model.startsWith('muse-wonder')&&typeof router.startBackground==='function';
        if(body.background!==undefined&&typeof body.background!=='boolean')throw new RequestError(400,'Invalid background request.');
        if(background&&args.images?.some(image=>image.length>800_000))throw new RequestError(413,'Use a smaller image for background creation.');
        if(s.background&&!s.background.result)throw new RequestError(409,'A background lesson is still in progress.');
        if(s.background?.result)delete s.background;
        if(args.images&&s.llm.provider!=='meta')throw new RequestError(400,'Image input needs a Meta model. Switch the model or remove the image.');
        if(s.attempts>=8||!await state.consumeTurn(bucket,limit)){const failure=quotaExceeded();failure.attemptsRemaining=8-s.attempts;throw failure;}
        s.attempts++;await save();
        if(background){
          try{
            const startedAt=Date.now(),started=await router.startBackground(s.llm.id,args);
            if(!await access.active(tester.id))throw new RequestError(401,'Sign in to tester access.');
            if(!started.pendingId){const result=readLessonAuthor(started,'compose',body.creation);const answer={...result,model:started.model??s.llm.model,elapsedMs:Date.now()-startedAt,usage:started.usage?{input:started.usage.input_tokens??null,output:started.usage.output_tokens??null}:null,llm:s.llm,attemptsRemaining:8-s.attempts};s.background={result:answer};await save();json(200,answer);return;}
            s.background={id:started.pendingId,creation:body.creation??'catalog',startedAt};await save();
            json(202,{pending:true,attemptsRemaining:8-s.attempts});return;
          }catch(error){if(error instanceof RequestError)throw error;const failure=new RequestError(502,'Background lesson could not be started. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;throw failure;}
        }
        const trace=traceEnabled?createTrace(redacted,{initial:await state.readTrace(body.sessionId),onChange:rows=>state.writeTrace(body.sessionId,rows,lock)}):null;
        const call=trace?.start({provider:llm.provider,model:llm.model,input:args.input,instructions:args.instructions});
        try{
          await trace?.flush();const options={...args,...(call?{onTrace:call.event}:{})};
          const startedAt=performance.now(),raw=await(modelCall?modelCall(options,llm.id):router.call(llm.id,options));let result=null;
          try{result=mode==='tryout'?readLearnerTryout(raw,validateLesson(body.lesson),body.language):mode==='show'?{show:readShow(raw,validateLesson(body.lesson))}:readLessonAuthor(raw,mode,body.creation,mode==='guide'&&body.explanation!==undefined);}catch(error){throw tagRejection(error);}
          const metrics={model:raw.model??llm.model,elapsedMs:Math.round(performance.now()-startedAt),usage:raw.usage?{input:raw.usage.input_tokens??null,output:raw.usage.output_tokens??null}:null};
          // A show gets one cover illustration from Muse Image when Meta is configured; a failed
          // or missing image never fails the show. Image bytes go to the client only.
          if(mode==='show'){
            result.cover=null;result.coverModel=null;result.illustrations={};
            const timeoutMs=imageBudgetMs(metrics.elapsedMs);
            if(imageCall&&llm.provider==='meta'&&timeoutMs>0){
              const imageTrace=trace?.start({provider:'meta',model:'muse-image-1.0',input:result.show.coverPrompt,instructions:'image generation'});
              try{const image=await imageCall({prompt:result.show.coverPrompt,timeoutMs,...(imageTrace?{onTrace:imageTrace.event}:{})});result.cover=await storeImage(image,ownerOf(tester));result.coverModel=image.model;imageTrace?.finish('accepted');}
              catch{imageTrace?.finish('failed or rejected');}
              // Slides the writer flagged get an illustration too, one at a time, while the
              // request budget allows; the rest are left for the player's Illustrate button.
              const flagged=result.show.slides.map((s,i)=>s.illustrate?i:-1).filter(i=>i>0);
              for(const index of flagged){
                const left=imageBudgetMs(Math.round(performance.now()-startedAt));
                if(left<=0){result.illustrationsSkipped=(result.illustrationsSkipped??0)+1;continue;}
                const prompt=illustrationPrompt(result.show,index);
                const slideTrace=trace?.start({provider:'meta',model:'muse-image-1.0',input:prompt,instructions:'image generation'});
                try{const image=await imageCall({prompt,timeoutMs:left,...(slideTrace?{onTrace:slideTrace.event}:{})});result.illustrations[index]=await storeImage(image,ownerOf(tester));slideTrace?.finish('accepted');}
                catch{slideTrace?.finish('failed or rejected');}
              }
            }else if(imageCall&&llm.provider==='meta')result.coverSkipped='time';
          }
          if(!await access.active(tester.id)){call?.finish('discarded');await state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
          if(!await state.get(body.sessionId))throw new RequestError(409,'Session was reset; response discarded.');
          call?.finish('accepted');try{await trace?.flush();}catch{}
          await save(trace?.read());json(200,{...result,...metrics,llm,attemptsRemaining:8-s.attempts});return;
        }catch(error){
          const reason=rejectionReason(error);
          call?.finish(error instanceof RequestError?'discarded':'failed or rejected',reason);
          if(error instanceof RequestError)throw error;
          if(['OLLAMA_BUSY','OLLAMA_UNCERTAIN','OLLAMA_OTHER_MODEL','OLLAMA_CONTROL'].includes(error.code)){const failure=new RequestError(409,error.message);failure.attemptsRemaining=8-s.attempts;throw failure;}
          const failure=new RequestError(502,'Provider lesson could not be completed or validated. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;failure.reason=reason;throw failure;
        }finally{try{await trace?.flush();}catch{}}
      }
      if(path.startsWith('/api/studio/'))throw new RequestError(400,'Start a Lesson Studio session first.');
      if(s.workflow==='quantum-showcase'){
        if(path!=='/api/quantum/explain')throw new RequestError(400,'Use this session for the quantum showcase only.');
        let args;try{args=quantumCoachRequest(body,s.language);}catch{throw new RequestError(400,'Choose an allowed circuit and preset question.');}
        if(s.attempts>=8||!await state.consumeTurn(bucket,limit))throw quotaExceeded();
        s.attempts++;await save();
        const trace=traceEnabled?createTrace(redacted,{initial:await state.readTrace(body.sessionId),onChange:rows=>state.writeTrace(body.sessionId,rows,lock)}):null;
        const call=trace?.start({provider:s.llm.provider,model:s.llm.model,input:args.input,instructions:args.instructions});
        try{
          await trace?.flush();const options={...args,...(call?{onTrace:call.event}:{})};
          const result=readQuantumCoach(await (modelCall?modelCall(options):router.call(s.llm.id,options)));
          if(!await access.active(tester.id)){call?.finish('discarded');await state.remove(body.sessionId);throw new RequestError(401,'Sign in to tester access.');}
          if(!await state.get(body.sessionId))throw new RequestError(409,'Session was reset; response discarded.');
          call?.finish('accepted');try{await trace?.flush();}catch{}
          await save(trace?.read());json(200,{...result,llm:s.llm,attemptsRemaining:8-s.attempts});return;
        }catch(error){
          call?.finish(error instanceof RequestError?'discarded':'failed or rejected');
          if(error instanceof RequestError)throw error;
          const failure=new RequestError(502,'Provider explanation could not be completed or validated. Retry explicitly.');failure.attemptsRemaining=8-s.attempts;throw failure;
        }finally{try{await trace?.flush();}catch{}}
      }
      if(path==='/api/quantum/explain')throw new RequestError(400,'Start a quantum showcase session first.');
      if(path==='/api/claim') {
        if(s.workflow!=='claim-testing')throw new RequestError(400,'This session has no claim to confirm.');
        let result;
        try{result=confirmClaim(s,{claimId:body.claimId,decision:body.decision,source:body.source});}
        catch{throw new RequestError(400,'The claim changed or cannot be confirmed.');}
        await save();json(200,{sessionId:body.sessionId,...result,llm:s.llm});
        return;
      }
      if(path==='/api/replay') {
        if(s.workflow!=='claim-testing')throw new RequestError(404,'Evidence not found.');
        try{json(200,replayClaimEvidence(s,body.evidenceId));}
        catch{throw new RequestError(404,'Evidence not found or failed integrity checks.');}
        return;
      }
      if(s.phase==='confirm')throw new RequestError(400,'Confirm or revise the claim interpretation first.');
      if(body.demoPreset!==undefined&&typeof body.demoPreset!=='boolean')throw new RequestError(400,'Use a boolean preset flag.');
      if(body.answer!==undefined&&!answerShapeValid(s,body.answer))
        throw new RequestError(400,'Enter the two numeric values for this topic, or leave both blank to ask for help.');
      if (!s.llm.configured) throw new RequestError(503, 'Selected provider is not configured.');
      if (s.phase === 'complete') throw new RequestError(400, 'This session is complete. Start another example.');
      if (typeof body.explanation !== 'string' || !body.explanation.trim() || body.explanation.length > 1200) throw new RequestError(400, 'Enter 1–1200 characters of synthetic reasoning.');
      if (s.attempts >= 12 || !await state.consumeTurn(bucket,limit)) throw quotaExceeded();
      s.attempts++;
      if(body.demoPreset)s.demoUsed=true;
      await save(); // Count attempts before sending, including rejected upstream output.
      s.trace=traceEnabled?createTrace(redacted,{initial:await state.readTrace(body.sessionId),onChange:rows=>state.writeTrace(body.sessionId,rows,lock)}):null;
      let traceCall;
      try {
        const result = await assess(s, body.explanation.trim(), async args=>{
          traceCall=s.trace?.start({provider:s.llm.provider,model:s.llm.model,input:args.input,instructions:args.instructions});
          await s.trace?.flush();
          const options={...args,...(traceCall?{onTrace:traceCall.event}:{})};
          return modelCall?modelCall(options):router.call(s.llm.id,options);
        }, body.answer);
        if(!await access.active(tester.id)){traceCall?.finish('discarded');await state.remove(body.sessionId);json(401,{error:'Sign in to tester access.',code:'TESTER_REQUIRED'});return;}
        if (!await state.get(body.sessionId)) throw new RequestError(409, 'Session was reset; the response was discarded.');
        const next=advance(s, body.explanation.trim(), result, body.answer);
        traceCall?.finish('accepted');
        // Drain intermediate writes; the atomic final save repairs a failed trace write.
        try{await s.trace?.flush();}catch{}
        await save(s.trace?.read());json(200, { sessionId: body.sessionId, ...next,llm:s.llm });
      } catch (error) {
        traceCall?.finish(error instanceof RequestError?'discarded':'failed or rejected');
        if (error instanceof RequestError) throw error;
        if(['OLLAMA_BUSY','OLLAMA_UNCERTAIN','OLLAMA_OTHER_MODEL','OLLAMA_CONTROL'].includes(error.code)){traceCall?.event({type:'error',message:error.message});throw new RequestError(409,error.message);}
        // Deliberately do not log or return raw upstream errors, prompts or secrets.
        const failure = new RequestError(502, 'Provider feedback could not be completed or validated. Your text is preserved. Check the selected model and connection, then retry explicitly.');
        failure.attemptsRemaining = Math.max(0, 12 - s.attempts);
        throw failure;
      } finally { try{await s.trace?.flush();}catch{/* Diagnostics cannot override a committed response. */} }
    } finally {
      if(lock)try{await state.release(lockedId,lock);}catch{/* A bounded lease expires after a storage failure. */}
    }
  }));
  app.use((req,res) => reply(res,404,{error:'Not found.'}));
  app.use((error,req,res,next) => {
    if(res.headersSent)return next(error);
    const status=error instanceof RequestError?error.status:error.type==='entity.too.large'?413:error.type==='encoding.unsupported'?415:error.type==='entity.parse.failed'?400:500;
    const message=error instanceof RequestError?error.message:status===413?'Request is too large.':status===415?'Unsupported request encoding.':status===400?'Invalid JSON request.':'Request failed. Please try again.';
    reply(res,status,{error:message,...(error instanceof RequestError&&error.code==='BACKGROUND_FAILED'?{code:error.code}:{}),...(Number.isInteger(error.attemptsRemaining)?{attemptsRemaining:error.attemptsRemaining}:{}),...(typeof error.reason==='string'&&error.reason?{reason:error.reason}:{})});
  });
  return app;

}

export function createApp(options={}) {
  const server=createServer(createHandler(options));
  server.requestTimeout = 45_000;
  server.headersTimeout = 10_000;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer from 1024 to 65535.');
  const server = createApp();
  server.on('error', () => { console.error('Could not start the local server. Check whether the port is already in use.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`ExplainBack local tester prototype: http://127.0.0.1:${port}`);
    if (process.env.EXPLAINBACK_OPEN_ACCESS === '1') console.warn('EXPLAINBACK_OPEN_ACCESS=1: no sign-in required on this local server. Never set this in a hosted environment.');
  });
}
