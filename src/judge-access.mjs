import {createHash,randomBytes} from 'node:crypto';
import {RequestError} from './request-error.mjs';
import {memoryJudgeChallenges,makeJudgeChallenge,challengeHash} from './judge-challenge.mjs';
export const JUDGE_TTL=30*60_000,JUDGE_CALLS=50,JUDGE_DAILY_CALLS=500,JUDGE_RETENTION=7*86400_000;
export const JUDGE_STARTS_PER_VISITOR=10,JUDGE_START_WINDOW=60_000,JUDGE_STARTS_GLOBAL=100,JUDGE_GLOBAL_START_WINDOW=3600_000;
export const JUDGE_SAVES=10,JUDGE_DAILY_SAVES=100,JUDGE_SAVED_RECORDS=100;
export const judgeOwner=owner=>typeof owner==='string'&&owner.startsWith('code:judge:');
export const judgeDay=now=>new Date(now).toISOString().slice(0,10);
const digest=value=>createHash('sha256').update(value).digest('hex');
export const judgeCookieId=cookie=>{const token=typeof cookie==='string'?cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('explainback_tester='))?.slice(19):null;return /^[a-f0-9]{64}$/.test(token??'')?digest(token):null;};
export const judgeActive=(record,now)=>Boolean(record&&record.revokedAt===null&&record.expiresAt>now);
export function judgeError(code,retryAfter){
 const messages={JUDGE_CHALLENGE:[400,'Complete a new quick check before starting Judge mode.'],JUDGE_CHALLENGE_RATE:[429,'Too many quick checks requested. Please wait and try again.'],JUDGE_SAVE_LIMIT:[429,'This judge session has used its save allowance. Export your work to keep it.'],JUDGE_DAILY_SAVE_LIMIT:[429,'The shared daily judge save allowance is used up. Export your work or try after 00:00 UTC.'],JUDGE_SAVED_LIMIT:[429,'Trial saved-lesson storage is full. Export your work; an administrator can clear older trial lessons.'],JUDGE_DISABLED:[403,'Judge mode is currently unavailable.'],JUDGE_EXPIRED:[401,'Your judge session has ended. Start a new judge session to continue.'],JUDGE_START_LIMIT:[429,'Too many judge sessions started. Please try again shortly.'],JUDGE_SESSION_LIMIT:[429,'This judge session has used its 50 model calls. Public lessons are still available.'],JUDGE_DAILY_LIMIT:[429,'The shared daily judge allowance is used up. It resets at 00:00 UTC. Public lessons are still available.']};
 const [status,message]=messages[code]??[503,'Judge usage storage is unavailable. No model call was sent.'];
 const wait=Number.isFinite(retryAfter)&&retryAfter>0?Math.ceil(retryAfter):undefined;
 return Object.assign(new RequestError(status,code==='JUDGE_START_LIMIT'?`Too many judge sessions started. ${wait?`Try again in ${wait} seconds.`:'Please try again shortly.'}`:message),{code,...(wait?{retryAfter:wait}:{})});
}
export const judgeRecord=({authId,publicId},now)=>({authId,id:publicId,createdAt:now,expiresAt:now+JUDGE_TTL,revokedAt:null,calls:[],saves:0});
export function judgeCallResult({outcome,usage}={}){
 const number=v=>Number.isFinite(v)&&v>=0?Math.min(Math.floor(v),1e12):null;
 return {outcome:outcome==='succeeded'?'succeeded':'failed',input:number(usage?.input_tokens),output:number(usage?.output_tokens),cached:number(usage?.input_tokens_details?.cached_tokens)};
}
export function judgeSummary(record,now){
 const calls=record.calls??[],models={},actions={};let inputTokens=0,outputTokens=0,cachedTokens=0,reportedCalls=0;
 for(const call of calls){models[call.model]=(models[call.model]??0)+1;actions[call.action]=(actions[call.action]??0)+1;if(call.input!==null&&call.input!==undefined){inputTokens+=call.input;reportedCalls++;}outputTokens+=call.output??0;cachedTokens+=call.cached??0;}
 return {id:record.id,saves:record.saves??0,createdAt:record.createdAt,expiresAt:record.expiresAt,status:record.revokedAt!==null?'revoked':record.expiresAt<=now?'expired':'active',calls:calls.length,used:calls.length-(record.callBaseline??0),remaining:Math.max(0,JUDGE_CALLS-calls.length+(record.callBaseline??0)),succeeded:calls.filter(c=>c.outcome==='succeeded').length,failed:calls.filter(c=>c.outcome==='failed').length,pending:calls.filter(c=>c.outcome==='pending').length,inputTokens,outputTokens,cachedTokens,reportedCalls,models,actions};
}
// Synchronous mutations before returning promises make reservations atomic locally.
export function createMemoryJudgeStore({now=Date.now}={}){
 const records=new Map(),days=new Map(),starts=new Map(),resets=[],challenges=memoryJudgeChallenges({now});
 const prune=()=>{for(const [id,r]of records)if(r.createdAt+JUDGE_RETENTION<=now())records.delete(id);for(const [id,r]of starts)if(r.until<=now())starts.delete(id);for(const [day,r]of days)if(r.until<=now())days.delete(day);};
 const count=key=>{const r=starts.get(key);return r&&r.until>now()?r.count:0;};
 const bump=(key,window)=>{const r=starts.get(key);starts.set(key,{count:count(key)+1,until:r&&r.until>now()?r.until:now()+window});};
 return {
  ...challenges,
  async reset({type,sessionId,reason,client}){
   prune();const day=judgeDay(now());let previousUsed=0;
   if(type==='session'){const r=[...records.values()].find(r=>r.id===sessionId);if(!judgeActive(r,now()))return {error:'JUDGE_EXPIRED'};previousUsed=r.calls.length-(r.callBaseline??0);r.callBaseline=r.calls.length;}
   else if(type==='daily'){const d=days.get(day)??{used:0,until:Date.parse(day)+2*86400_000};previousUsed=d.used??0;d.totalBeforeReset=(d.totalBeforeReset??0)+previousUsed;d.used=0;days.set(day,d);}
   else if(type==='starts'){previousUsed=count('all');starts.delete('all');starts.delete('client:'+client);await challenges.resetChallengeCooldown(client);}
   else return {error:'JUDGE_RESET_INVALID'};
   resets.unshift({type,at:now(),reason,actor:'tester',previousUsed,...(type==='session'?{sessionId}:{})});resets.splice(100);return {ok:true};
  },
  async start({authId,publicId,client,previousId}){
   prune();const clientKey='client:'+client;
   const blocked=[[clientKey,JUDGE_STARTS_PER_VISITOR],['all',JUDGE_STARTS_GLOBAL]].filter(([key,limit])=>count(key)>=limit);
   if(blocked.length)return {error:'JUDGE_START_LIMIT',retryAfter:Math.max(...blocked.map(([key])=>Math.max(1,Math.ceil((starts.get(key).until-now())/1000))))};
   bump(clientKey,JUDGE_START_WINDOW);bump('all',JUDGE_GLOBAL_START_WINDOW);
   const previous=records.get(previousId);if(previous)previous.revokedAt=now();const record=judgeRecord({authId,publicId},now());records.set(authId,record);return {record:structuredClone(record)};
  },
  async find(id){prune();return structuredClone(records.get(id)??null);},
  async revoke(id){const r=records.get(id);if(r&&r.revokedAt===null)r.revokedAt=now();},
  async reserve(id,{model,action}){prune();const r=records.get(id);if(!judgeActive(r,now()))return {error:'JUDGE_EXPIRED'};if(r.calls.length-(r.callBaseline??0)>=JUDGE_CALLS)return {error:'JUDGE_SESSION_LIMIT'};const day=judgeDay(now()),used=days.get(day)?.used??0;if(used>=JUDGE_DAILY_CALLS)return {error:'JUDGE_DAILY_LIMIT'};days.set(day,{...days.get(day),used:used+1,until:Date.parse(day)+2*86400_000});const number=r.calls.length+1;r.calls.push({number,model,action,outcome:'pending',at:now()});return {number};},
  async reserveWrite(id){prune();const r=records.get(id);if(!judgeActive(r,now()))return {error:'JUDGE_EXPIRED'};if((r.saves??0)>=JUDGE_SAVES)return {error:'JUDGE_SAVE_LIMIT'};const day=judgeDay(now()),used=days.get(day)?.saves??0;if(used>=JUDGE_DAILY_SAVES)return {error:'JUDGE_DAILY_SAVE_LIMIT'};days.set(day,{...days.get(day),saves:used+1,until:Date.parse(day)+2*86400_000});r.saves=(r.saves??0)+1;return {ok:true};},
  async finish(id,number,result){const r=records.get(id),call=r?.calls[number-1];if(call?.outcome==='pending')Object.assign(call,judgeCallResult(result));},
  async list(cursor=0){prune();const rows=[...records.values()].sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id)),day=judgeDay(now());return {sessions:rows.slice(cursor,cursor+50).map(r=>judgeSummary(r,now())),cursor:cursor+50<rows.length?String(cursor+50):null,daily:{date:day,used:days.get(day)?.used??0,total:(days.get(day)?.used??0)+(days.get(day)?.totalBeforeReset??0),limit:JUDGE_DAILY_CALLS},resets:structuredClone(resets.filter(r=>r.at+JUDGE_RETENTION>now())),retentionDays:7};},
 };
}
// Judge sessions are a separate audience. A public start can never mint the null
// audience that grants administrator access to the password-authenticated tester.
export function createJudgeAccess({auth,store,enabled=false,now=Date.now}){
 const identity=r=>({id:r.authId,audience:{kind:'judge',label:'judge:'+r.id,quota:JUDGE_CALLS,callCeiling:JUDGE_CALLS+(r.callBaseline??0),expiresAt:r.expiresAt}});
 const result=record=>enabled&&judgeActive(record,now())?identity(record):null;
 const wrapped={...auth,
  async authenticate(cookie){const id=judgeCookieId(cookie),record=id?await store.find(id):null;return record?result(record):auth.authenticate(cookie);},
  async active(id){const record=await store.find(id);return record?Boolean(result(record)):auth.active(id);},
  async revoke(cookie){const id=judgeCookieId(cookie);if(id)await store.revoke(id);return auth.revoke(cookie);},
  async login(body,cookie,options={}){
   if(body?.judge!==true){const logged=await auth.login(body,cookie,options);const previous=judgeCookieId(cookie);if(previous)await store.revoke(previous);return logged;}
   if(!enabled)throw judgeError('JUDGE_DISABLED');
   const client=digest(options.client||'unknown');
   if(typeof body.challengeId!=='string'||! /^[a-f0-9]{48}$/.test(body.challengeId)||typeof body.answer!=='string'||! /^\d{1,6}$/.test(body.answer.trim())||!await store.verifyChallenge(body.challengeId,challengeHash(body.challengeId,body.answer.trim()),client))throw judgeError('JUDGE_CHALLENGE');
   const token=randomBytes(32).toString('hex'),authId=digest(token),publicId=randomBytes(8).toString('hex'),previousId=judgeCookieId(cookie);
   const started=await store.start({authId,publicId,previousId,client});if(started.error)throw judgeError(started.error,started.retryAfter);
   // The issuance store atomically revokes an earlier judge login. Revoke an ordinary
   // login as well, after successful issuance; failed starts keep the old login valid.
   if(previousId)await auth.revoke(cookie);
   return {...identity(started.record),cookie:`explainback_tester=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=1800${auth.expiredCookie?.includes('Secure')?'; Secure':''}`};
  },
 };
 return {auth:wrapped,
  async challenge(kind,client){
   if(!enabled)throw judgeError('JUDGE_DISABLED');
   const record=makeJudgeChallenge(kind,now()),issued=await store.issueChallenge(record,digest(client||'unknown'));
   if(issued.error)throw judgeError(issued.error,issued.retryAfter);return record.public;
  },
  async status(tester){const r=await store.find(tester.id);if(!result(r))throw judgeError('JUDGE_EXPIRED');return {kind:'judge',label:r.id,remaining:Math.max(0,JUDGE_CALLS-r.calls.length+(r.callBaseline??0)),quota:JUDGE_CALLS,expiresAt:r.expiresAt};},
  async write(tester){
   if(tester?.audience?.kind!=='judge')return;
   if(!enabled)throw judgeError('JUDGE_DISABLED');
   let result;try{result=await store.reserveWrite(tester.id);}catch{throw judgeError('JUDGE_STORAGE');}
   if(result.error)throw judgeError(result.error);
  },
  async run(tester,details,invoke){
   if(tester?.audience?.kind!=='judge')return invoke();
   if(!enabled)throw judgeError('JUDGE_DISABLED');
   let reserved;try{reserved=await store.reserve(tester.id,details);}catch{throw judgeError('JUDGE_STORAGE');}
   if(reserved.error)throw judgeError(reserved.error);
   let raw;try{raw=await invoke();}catch(error){try{await store.finish(tester.id,reserved.number,{outcome:'failed'});}catch{}throw error;}
   // A completion-record outage leaves a conservatively charged pending call. Never
   // retry an uncertain provider request, or refund it, based on bookkeeping failure.
   try{await store.finish(tester.id,reserved.number,{outcome:'succeeded',usage:raw?.usage});}catch{}
   if(!await wrapped.active(tester.id))throw judgeError('JUDGE_EXPIRED');
   return raw;
  },
 };
}
