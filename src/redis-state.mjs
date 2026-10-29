import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {SESSION_TTL,LOCK_TTL,snapshot} from './state.mjs';
import {findAccessCode,audienceOf,audienceValid} from './access-codes.mjs';

const AUTH_TTL=8*60*60_000,COOKIE='explainback_tester';
const digest=value=>createHash('sha256').update(value).digest();
const fail=(status,code,message)=>{throw Object.assign(new Error(message),{status,code});};
// Mutations use atomic Lua scripts. Never retry an uncertain write or expose a Redis error body.
export function createRedisClient({url,token,fetchImpl=globalThis.fetch}={}){
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/'||!token)throw new Error('Configure the Redis REST URL and token.');
 return async command=>{
  try{
   const response=await fetchImpl(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10_000),redirect:'error'});
   if(!response.ok)throw new Error();const data=await response.json();
   if(data.error||!Object.hasOwn(data,'result'))throw new Error();return data.result;
  }catch{throw new Error('Shared session storage is unavailable.');}
 };
}

export function createRedisServices({command,namespace='explainback:preview:v1',username,password,accessCodes=[],now=Date.now}={}){
 const configured=typeof username==='string'&&username.trim().length>0&&username.length<=80&&typeof password==='string'&&password.length>=12&&password.length<=512;
 const userHash=digest(configured?username:''),passwordHash=digest(configured?password:'');
 // A credential change invalidates old cookies, including across deployments.
 const prefix=`${namespace}:{${digest(JSON.stringify([username,password])).toString('hex').slice(0,24)}}:`;
 const key=(kind,id='')=>prefix+kind+':'+id;
 const run=(script,keys=[],args=[])=>command(['EVAL',script,keys.length,...keys,...args]);
 // EVAL is sent to the primary; writes and their authorization checks share a script.
 const get=k=>run("return redis.call('GET',KEYS[1])",[k]);
 const authKey=id=>key('auth',id);
 const tokenId=cookie=>{
  const token=typeof cookie==='string'?cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1):null;
  return /^[a-f0-9]{64}$/.test(token??'')?digest(token).toString('hex'):null;
 };
 const auth={
  configured,codesConfigured:accessCodes.length>0,expiredCookie:`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  // The auth value is '1' for the tester login or a JSON audience for an access code.
  // A removed, rotated or expired code invalidates its cookies on the next request.
  async authenticate(cookie){
   const id=tokenId(cookie);const value=id?await get(authKey(id)):null;if(!value)return null;
   if(value==='1')return {id,audience:null};
   let audience;try{audience=JSON.parse(value).audience;}catch{return null;}
   if(!audienceValid(accessCodes,audience,now())){await auth.revoke(cookie);return null;}
   return {id,audience};
  },
  async active(id){return Boolean(await get(authKey(id)));},
  async revoke(cookie){const id=tokenId(cookie);if(!id)return;const buckets=['tester',...accessCodes.map(c=>c.label)];await run("redis.call('DEL',KEYS[1]);for i=2,#KEYS do redis.call('ZREM',KEYS[i],ARGV[1]) end;return 1",[authKey(id),...buckets.map(b=>key('logins',b))],[id]);},
  async login(body,cookie){
   let valid,audience=null;
   if(body?.code!==undefined){
    const entry=typeof body.code==='string'&&body.code.length<=64?findAccessCode(accessCodes,body.code,now()):null;
    valid=Boolean(entry);if(entry)audience=audienceOf(entry);
   }else{
    if(!configured)fail(503,'TESTER_SETUP','Configure tester access in the server environment.');
    const shape=typeof body?.username==='string'&&body.username.length<=80&&typeof body?.password==='string'&&body.password.length<=512;
    const userMatch=timingSafeEqual(digest(shape?body.username:''),userHash),passwordMatch=timingSafeEqual(digest(shape?body.password:''),passwordHash);
    valid=shape&&userMatch&&passwordMatch;
   }
   const token=randomBytes(32).toString('hex'),id=digest(token).toString('hex'),previous=tokenId(cookie);
   const expiresAt=Math.min(now()+AUTH_TTL,audience?.expiresAt??Infinity),ttl=expiresAt-now(),bucket=audience?.label??'tester';
   const result=await run(`
    if tonumber(redis.call('GET',KEYS[1]) or '0')>=5 then return 'rate' end
    if ARGV[1]~='yes' then local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('PEXPIRE',KEYS[1],60000) end;return 'invalid' end
    redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[2])
    if redis.call('ZCARD',KEYS[2])>=20 and redis.call('EXISTS',KEYS[3])==0 then return 'capacity' end
    redis.call('DEL',KEYS[1],KEYS[3]);redis.call('ZREM',KEYS[2],ARGV[4])
    redis.call('SET',KEYS[4],ARGV[7],'PX',ARGV[5]);redis.call('ZADD',KEYS[2],ARGV[3],ARGV[6]);redis.call('PEXPIRE',KEYS[2],ARGV[5]);return 'ok'
   `,[key('login-failures'),key('logins',bucket),authKey(previous??'none'),authKey(id)],[valid?'yes':'no',now(),expiresAt,previous??'none',ttl,id,audience?JSON.stringify({audience}):'1']);
   if(result==='rate')fail(429,'TESTER_RATE','Too many login attempts. Try again in one minute.');
   if(result==='invalid'){if(body?.code!==undefined)fail(401,'ACCESS_CODE','This access code is not valid or has expired.');fail(401,'TESTER_CREDENTIALS','Username or password is incorrect.');}
   if(result==='capacity')fail(429,'TESTER_CAPACITY','Tester session limit reached. Sign out another session or wait for expiry.');
   if(result!=='ok')throw new Error('Could not create tester session.');
   return {id,audience,cookie:`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(ttl/1000)}`};
  },
 };
 const sessionKey=id=>key('session',id),lockKey=id=>key('lock',id),traceKey=id=>key('trace',id);
 const state={
  async create(id,s){return await run(`
   if redis.call('EXISTS',KEYS[3])==0 then return 0 end
   redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]);if redis.call('ZCARD',KEYS[1])>=100 then return 0 end
   redis.call('SET',KEYS[2],ARGV[4],'PX',ARGV[5]);redis.call('ZADD',KEYS[1],ARGV[2],ARGV[3]);redis.call('PEXPIRE',KEYS[1],ARGV[5]);return 1
  `,[key('sessions'),sessionKey(id),authKey(s.owner)],[now(),s.createdAt+SESSION_TTL,id,JSON.stringify(snapshot(s)),SESSION_TTL])===1;},
  async get(id){const value=await get(sessionKey(id));return value?JSON.parse(value):null;},
  async remove(id){await run("redis.call('DEL',KEYS[1],KEYS[2],KEYS[3]);redis.call('ZREM',KEYS[4],ARGV[1]);return 1",[sessionKey(id),traceKey(id),lockKey(id),key('sessions')],[id]);},
  async acquire(id){const token=randomUUID();return await run("if redis.call('EXISTS',KEYS[1])==0 then return 0 end;return redis.call('SET',KEYS[2],ARGV[1],'NX','PX',ARGV[2])",[sessionKey(id),lockKey(id)],[token,LOCK_TTL])==='OK'?token:null;},
  async release(id,token){await run("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",[lockKey(id)],[token]);},
  async save(id,s,token,rows){return await run(`
   if redis.call('GET',KEYS[1])~=ARGV[1] or redis.call('EXISTS',KEYS[3])==0 then return 0 end
   local ttl=redis.call('PTTL',KEYS[2]);if ttl<=0 then return 0 end
   redis.call('SET',KEYS[2],ARGV[2],'PX',ttl)
   if ARGV[3]~='' then redis.call('SET',KEYS[4],ARGV[3],'PX',ttl) end;return 1
  `,[lockKey(id),sessionKey(id),authKey(s.owner),traceKey(id)],[token,JSON.stringify(snapshot(s)),rows?JSON.stringify(rows):''])===1;},
  async readTrace(id){const value=await get(traceKey(id));return value?JSON.parse(value):[];},
  async writeTrace(id,rows,token){await run(`
   if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end
   local ttl=redis.call('PTTL',KEYS[2]);if ttl<=0 then return 0 end
   redis.call('SET',KEYS[3],ARGV[2],'PX',ttl);return 1
  `,[lockKey(id),sessionKey(id),traceKey(id)],[token,JSON.stringify(rows)]);},
  async consumeTurn(bucket='global',limit=60){return await run("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('PEXPIRE',KEYS[1],3600000) end;return n",[key('turns',bucket)])<=limit;},
  async remainingTurns(bucket='global',limit=60){return Math.max(0,limit-Number(await get(key('turns',bucket))??0));},
 };
 return {state,auth};
}
