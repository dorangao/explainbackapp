import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {findAccessCode,audienceOf,audienceValid} from './access-codes.mjs';
const COOKIE='explainback_tester',TTL=8*60*60_000;
// Failed sign-ins are counted per visitor (5 a minute), so one person's typos cannot
// lock everyone out, with a much higher shared backstop (100 a minute across all
// visitors) against distributed guessing. Sign-ins per access code are capped well above
// a judging panel's needs; the shared tester account keeps a smaller pool.
export const CLIENT_FAILURE_LIMIT=5,GLOBAL_FAILURE_LIMIT=100,FAILURE_WINDOW_MS=60_000;
export const MAX_SESSIONS={tester:20,code:100};
const digest=value=>createHash('sha256').update(value).digest();
export const clientKey=client=>digest(typeof client==='string'&&client.trim()?client.trim():'unknown').toString('hex').slice(0,32);
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
export const expiredTesterCookie=`${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
// Local shared tester access. Tokens and learning state live only in this process.
// Reviewer access codes sign in without the password and carry their own audience/quota.
export function createTesterAuth({username=process.env.EXPLAINBACK_TESTER_USERNAME,password=process.env.EXPLAINBACK_TESTER_PASSWORD,accessCodes=[],now=Date.now,onRevoke=()=>{}}={}){
 const configured=typeof username==='string'&&username.trim().length>0&&username.length<=80&&typeof password==='string'&&password.length>=12&&password.length<=512;
 const expectedUser=digest(configured?username:''),expectedPassword=digest(configured?password:'');
 const sessions=new Map(),failures=new Map();
 const count=key=>{const f=failures.get(key);return f&&now()-f.start<FAILURE_WINDOW_MS?f.n:0;};
 const bump=key=>{const f=failures.get(key);if(f&&now()-f.start<FAILURE_WINDOW_MS)f.n++;else failures.set(key,{n:1,start:now()});if(failures.size>5000)for(const [k,v] of failures)if(now()-v.start>=FAILURE_WINDOW_MS)failures.delete(k);};
 const tokenId=cookie=>{
  if(typeof cookie!=='string')return null;
  const token=cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  return /^[a-f0-9]{64}$/.test(token??'')?digest(token).toString('hex'):null;
 };
 const remove=id=>{if(sessions.delete(id))onRevoke(id);};
 const prune=()=>{for(const [id,s]of sessions)if(s.expiresAt<=now()||(s.audience&&!audienceValid(accessCodes,s.audience,now())))remove(id);};
 const bucket=s=>s.audience?.label??'tester';
 return {
  configured,codesConfigured:accessCodes.length>0,
  authenticate(cookie){prune();const s=sessions.get(tokenId(cookie));return s?{id:s.id,audience:s.audience}:null;},
  active(id){prune();return sessions.has(id);},
  revoke(cookie){remove(tokenId(cookie));},
  login(body,cookie,{client=''}={}){
   const visitor='client:'+clientKey(client);
   if(count(visitor)>=CLIENT_FAILURE_LIMIT||count('all')>=GLOBAL_FAILURE_LIMIT)fail(429,'TESTER_RATE','Too many login attempts. Try again in one minute.');
   const failed=(code,message)=>{bump(visitor);bump('all');fail(401,code,message);};
   let audience=null;
   if(body?.code!==undefined){
    const entry=typeof body.code==='string'&&body.code.length<=64?findAccessCode(accessCodes,body.code,now()):null;
    if(!entry)failed('ACCESS_CODE','This access code is not valid or has expired.');
    audience=audienceOf(entry);
   }else{
    if(!configured)fail(503,'TESTER_SETUP','Configure tester access in the server environment.');
    const validShape=typeof body?.username==='string'&&body.username.length<=80&&typeof body?.password==='string'&&body.password.length<=512;
    const userMatch=timingSafeEqual(digest(validShape?body.username:''),expectedUser);
    const passwordMatch=timingSafeEqual(digest(validShape?body.password:''),expectedPassword);
    if(!validShape||!userMatch||!passwordMatch)failed('TESTER_CREDENTIALS','Username or password is incorrect.');
   }
   prune();const previousId=tokenId(cookie),label=audience?.label??'tester',cap=audience?MAX_SESSIONS.code:MAX_SESSIONS.tester;
   const occupied=[...sessions.values()].filter(s=>bucket(s)===label).length;
   if(occupied>=cap&&!(sessions.has(previousId)&&bucket(sessions.get(previousId))===label))fail(429,'TESTER_CAPACITY','Tester session limit reached. Sign out another session or restart the local server.');
   remove(previousId);failures.delete(visitor);
   const token=randomBytes(32).toString('hex'),id=digest(token).toString('hex'),expiresAt=Math.min(now()+TTL,audience?.expiresAt??Infinity);
   sessions.set(id,{id,expiresAt,audience});
   return {id,audience,cookie:`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor((expiresAt-now())/1000)}`};
  },
 };
}
