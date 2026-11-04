import {redisJudgeChallenges} from './judge-challenge.mjs';
import {JUDGE_TTL,JUDGE_CALLS,JUDGE_SAVES,JUDGE_DAILY_SAVES,JUDGE_DAILY_CALLS,JUDGE_RETENTION,JUDGE_STARTS_PER_VISITOR,JUDGE_START_WINDOW,JUDGE_STARTS_GLOBAL,JUDGE_GLOBAL_START_WINDOW,judgeDay,judgeRecord,judgeSummary,judgeCallResult} from './judge-access.mjs';
// All authorization, quota and issuance mutations run on the Redis primary in Lua.
// The auth key shares the existing state adapter's authorization boundary.
export function createRedisJudgeStore({run,key,get,authKey,now=Date.now}){
 const recordKey=id=>key('judge-session',id);
 // Upstash Lua cjson may omit null-valued object fields when rewriting JSON.
 // Restore the unrevoked sentinel before authorization and audit summaries use it.
 const load=async id=>{const raw=await get(recordKey(id));if(!raw)return null;const record=JSON.parse(raw);record.revokedAt??=null;if(!Array.isArray(record.calls))record.calls=[];return record;};
 return {
  ...redisJudgeChallenges({run,key,now}),
  async reset({type,sessionId='',reason,client}){
   // Public IDs are audit handles, never authorization tokens. The bounded fallback
   // supports sessions issued before this index was introduced; new sessions map directly.
   let id='none';
   if(type==='session'){
    id=await get(key('judge-public',sessionId))??'none';
    if(id==='none'){
     const ids=await run("return redis.call('ZREVRANGEBYSCORE',KEYS[1],'+inf',ARGV[1],'LIMIT',0,200)",[key('judge-index')],[now()-JUDGE_TTL]);
     for(const candidate of ids){const r=await load(candidate);if(r?.id===sessionId){id=candidate;break;}}
    }
   }
   const day=judgeDay(now()),event={type,at:now(),reason,actor:'tester',...(type==='session'?{sessionId}:{})};
   const outcome=await run(`
    local previous=0
    if ARGV[1]=='session' then
     local raw=redis.call('GET',KEYS[1]);if not raw then return 'JUDGE_EXPIRED' end;local r=cjson.decode(raw)
     if (r.revokedAt and r.revokedAt~=cjson.null) or r.expiresAt<=tonumber(ARGV[2]) or redis.call('EXISTS',KEYS[2])==0 then return 'JUDGE_EXPIRED' end
     previous=#r.calls-(r.callBaseline or 0);r.callBaseline=#r.calls;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL')
    elseif ARGV[1]=='daily' then
     previous=tonumber(redis.call('GET',KEYS[3]) or '0');redis.call('INCRBY',KEYS[4],previous);redis.call('PEXPIRE',KEYS[4],172800000);redis.call('SET',KEYS[3],'0','PX',172800000)
    elseif ARGV[1]=='starts' then
     local raw=redis.call('GET',KEYS[5]);if raw then previous=cjson.decode(raw).count end;redis.call('DEL',KEYS[5],KEYS[6],KEYS[7],KEYS[8])
    else return 'JUDGE_RESET_INVALID' end
    local event=cjson.decode(ARGV[3]);event.previousUsed=previous;redis.call('LPUSH',KEYS[9],cjson.encode(event));redis.call('LTRIM',KEYS[9],0,99);redis.call('PEXPIRE',KEYS[9],ARGV[4]);return 'ok'
   `,[recordKey(id),authKey(id),key('judge-day',day),key('judge-day-before-reset',day),key('judge-starts','all'),key('judge-starts-minute',client),key('judge-challenge-starts',client),key('judge-challenge-starts','all'),key('judge-resets')],[type,now(),JSON.stringify(event),JUDGE_RETENTION]);
   return outcome==='ok'?{ok:true}:{error:outcome};
  },
  async start({authId,publicId,client,previousId}){
   const record=judgeRecord({authId,publicId},now());
   const outcome=await run(`
    local buckets={};local retry=0;for i=1,2 do local raw=redis.call('GET',KEYS[i]);local b=raw and cjson.decode(raw) or {count=0,untilAt=0};if b.untilAt<=tonumber(ARGV[6]) then b={count=0,untilAt=tonumber(ARGV[6])+tonumber(ARGV[7+i])} end;buckets[i]=b;if b.count>=tonumber(ARGV[i]) then retry=math.max(retry,b.untilAt-tonumber(ARGV[6])) end end
    if retry>0 then return {'JUDGE_START_LIMIT',math.max(1,math.ceil(retry/1000))} end
    for i=1,2 do buckets[i].count=buckets[i].count+1;redis.call('SET',KEYS[i],cjson.encode(buckets[i]),'PX',math.max(1,buckets[i].untilAt-tonumber(ARGV[6]))) end
    local old=redis.call('GET',KEYS[5]);if old then local r=cjson.decode(old);r.revokedAt=tonumber(ARGV[6]);redis.call('SET',KEYS[5],cjson.encode(r),'KEEPTTL') end
    redis.call('DEL',KEYS[6]);redis.call('SET',KEYS[3],ARGV[3],'PX',ARGV[4]);redis.call('SET',KEYS[4],'{"judge":true}','PX',ARGV[5])
    redis.call('ZADD',KEYS[7],ARGV[6],ARGV[7]);redis.call('PEXPIRE',KEYS[7],ARGV[4]);redis.call('SET',KEYS[8],ARGV[7],'PX',ARGV[4]);return {'ok'}
   `,[key('judge-starts-minute',client),key('judge-starts','all'),recordKey(authId),authKey(authId),recordKey(previousId??'none'),authKey(previousId??'none'),key('judge-index'),key('judge-public',publicId)],[JUDGE_STARTS_PER_VISITOR,JUDGE_STARTS_GLOBAL,JSON.stringify(record),JUDGE_RETENTION,JUDGE_TTL,now(),authId,JUDGE_START_WINDOW,JUDGE_GLOBAL_START_WINDOW]);
   return outcome[0]==='ok'?{record}:{error:outcome[0],retryAfter:Number(outcome[1])};
  },
  async find(id){return id?load(id):null;},
  async revoke(id){if(!id)return;await run(`local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);if r.revokedAt==cjson.null or not r.revokedAt then r.revokedAt=tonumber(ARGV[1]);redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL') end;redis.call('DEL',KEYS[2]);return 1`,[recordKey(id),authKey(id)],[now()]);},
  async reserve(id,{model,action}){
   const result=await run(`
    local raw=redis.call('GET',KEYS[1]);if not raw then return {'JUDGE_EXPIRED'} end;local r=cjson.decode(raw)
    if (r.revokedAt and r.revokedAt~=cjson.null) or r.expiresAt<=tonumber(ARGV[1]) or redis.call('EXISTS',KEYS[3])==0 then return {'JUDGE_EXPIRED'} end
    if #r.calls-(r.callBaseline or 0)>=tonumber(ARGV[2]) then return {'JUDGE_SESSION_LIMIT'} end
    if tonumber(redis.call('GET',KEYS[2]) or '0')>=tonumber(ARGV[3]) then return {'JUDGE_DAILY_LIMIT'} end
    local n=redis.call('INCR',KEYS[2]);if n==1 then redis.call('PEXPIRE',KEYS[2],172800000) end
    local number=#r.calls+1;table.insert(r.calls,{number=number,model=ARGV[4],action=ARGV[5],outcome='pending',at=tonumber(ARGV[1])})
    redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return {'ok',number}
   `,[recordKey(id),key('judge-day',judgeDay(now())),authKey(id)],[now(),JUDGE_CALLS,JUDGE_DAILY_CALLS,model,action]);
   return result[0]==='ok'?{number:Number(result[1])}:{error:result[0]};
  },
  async reserveWrite(id){
   const result=await run(`
    local raw=redis.call('GET',KEYS[1]);if not raw then return 'JUDGE_EXPIRED' end;local r=cjson.decode(raw)
    if (r.revokedAt and r.revokedAt~=cjson.null) or r.expiresAt<=tonumber(ARGV[1]) or redis.call('EXISTS',KEYS[3])==0 then return 'JUDGE_EXPIRED' end
    if (r.saves or 0)>=tonumber(ARGV[2]) then return 'JUDGE_SAVE_LIMIT' end
    if tonumber(redis.call('GET',KEYS[2]) or '0')>=tonumber(ARGV[3]) then return 'JUDGE_DAILY_SAVE_LIMIT' end
    local n=redis.call('INCR',KEYS[2]);if n==1 then redis.call('PEXPIRE',KEYS[2],172800000) end
    r.saves=(r.saves or 0)+1;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 'ok'
   `,[recordKey(id),key('judge-write-day',judgeDay(now())),authKey(id)],[now(),JUDGE_SAVES,JUDGE_DAILY_SAVES]);
   return result==='ok'?{ok:true}:{error:result};
  },
  async finish(id,number,result){
   await run(`local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);local call=r.calls[tonumber(ARGV[1])];if not call or call.outcome~='pending' then return 0 end;local done=cjson.decode(ARGV[2]);for k,v in pairs(done) do call[k]=v end;redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL');return 1`,[recordKey(id)],[number,JSON.stringify(judgeCallResult(result))]);
  },
  async list(cursor=0){
   const ids=await run(`redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]);return redis.call('ZREVRANGE',KEYS[1],ARGV[2],ARGV[3])`,[key('judge-index')],[now()-JUDGE_RETENTION,cursor,cursor+50]);
   const rows=await Promise.all(ids.slice(0,50).map(load)),day=judgeDay(now());
   const [used,previous,resets]=await run("return {redis.call('GET',KEYS[1]) or '0',redis.call('GET',KEYS[2]) or '0',redis.call('LRANGE',KEYS[3],0,99)}",[key('judge-day',day),key('judge-day-before-reset',day),key('judge-resets')]);
   return {sessions:rows.filter(Boolean).map(r=>judgeSummary(r,now())),cursor:ids.length>50?String(cursor+50):null,daily:{date:day,used:Number(used),total:Number(used)+Number(previous),limit:JUDGE_DAILY_CALLS},resets:resets.map(JSON.parse).filter(r=>r.at+JUDGE_RETENTION>now()),retentionDays:7};
  },
 };
}
