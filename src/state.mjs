import {randomUUID} from 'node:crypto';
export const SESSION_TTL=30*60_000;
export const LOCK_TTL=90_000; // Longer than the hosted function's 60-second limit.
// Live Studio sessions per sign-in bucket (one access code, or the tester account). One
// bucket may not crowd the others out of the shared cap of 100: past its own cap, its
// oldest session that is not inside a request is evicted to make room.
export const MAX_SESSIONS_PER_BUCKET=30;
export const sessionBucket=s=>s?.audience??'tester';
export const snapshot=s=>structuredClone(Object.fromEntries(Object.entries(s).filter(([k])=>k!=='trace')));

// Local development adapter. The cloud adapter implements the same contract in Redis.
export function createMemoryState({now=Date.now}={}){
  // Creator-drawn library covers for reviewed lessons, by lesson id.
  const covers=new Map();
 const sessions=new Map(),traces=new Map(),locks=new Map(),turns=new Map(),lessons=new Map();
 // Hourly provider budgets per bucket: 'global' for tester logins, 'code:<label>' per access code.
 const counter=bucket=>{const c=turns.get(bucket);if(c&&now()-c.window<60*60_000)return c;const fresh={count:0,window:now()};turns.set(bucket,fresh);return fresh;};
 const remove=id=>{sessions.delete(id);traces.delete(id);locks.delete(id);};
 const prune=()=>{for(const [id,s] of sessions)if(now()-s.createdAt>=SESSION_TTL&&!locks.has(id))remove(id);};
 const owns=(id,token)=>sessions.has(id)&&locks.get(id)?.token===token;
 return {
  async create(id,s){
   prune();
   const bucket=sessionBucket(s),own=[...sessions.entries()].filter(([,x])=>sessionBucket(x)===bucket).sort((a,b)=>a[1].createdAt-b[1].createdAt);
   if(own.length>=MAX_SESSIONS_PER_BUCKET){const victim=own.find(([old])=>!locks.has(old));if(!victim)return false;remove(victim[0]);}
   if(sessions.size>=100)return false;sessions.set(id,snapshot(s));return true;
  },
  async get(id){prune();return sessions.has(id)?snapshot(sessions.get(id)):null;},
  async remove(id){remove(id);},
  revokeOwner(owner){for(const [id,s] of sessions)if(s.owner===owner)remove(id);},
  async acquire(id){const lock=locks.get(id);if(!sessions.has(id)||lock)return null;const token=randomUUID();locks.set(id,{token});return token;},
  async release(id,token){if(owns(id,token))locks.delete(id);},
  async save(id,s,token,rows){if(!owns(id,token))return false;sessions.set(id,snapshot(s));if(rows)traces.set(id,structuredClone(rows));return true;},
  async readTrace(id){return structuredClone(traces.get(id)??[]);},
  async writeTrace(id,rows,token){if(owns(id,token))traces.set(id,structuredClone(rows));},
  async consumeTurn(bucket='global',limit=60){return ++counter(bucket).count<=limit;},
  async remainingTurns(bucket='global',limit=60){return Math.max(0,limit-counter(bucket).count);},
  // Saved lessons persist for the process lifetime; a creator keeps at most `cap` of them.
  async putCover(id,record){covers.set(id,structuredClone(record));return true;},
  async getCovers(){return Object.fromEntries([...covers].map(([id,c])=>[id,structuredClone(c)]));},
  // `expected` is the snapshot read before an update; null means insert only.
  async putLesson(record,cap=50,expected){
   const existing=lessons.get(record.id)??null;
   if(expected!==undefined&&JSON.stringify(existing)!==JSON.stringify(expected))return false;
   if(existing&&existing.owner!==record.owner)return false;
   if(!existing&&[...lessons.values()].filter(r=>r.owner===record.owner).length>=cap)return false;
   lessons.set(record.id,structuredClone(record));return true;
  },
  async getLesson(id){return lessons.has(id)?structuredClone(lessons.get(id)):null;},
  async listLessons(owner){return [...lessons.values()].filter(r=>r.owner===owner).sort((a,b)=>b.updatedAt-a.updatedAt).map(r=>structuredClone(r));},
  async listAllLessons(cursor='0'){const rows=[...lessons.values()].sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id)),offset=Number(cursor);return {lessons:rows.slice(offset,offset+50).map(r=>structuredClone(r)),cursor:offset+50<rows.length?String(offset+50):null};},
  async deleteLesson(owner,id,expected){const r=lessons.get(id);if(!r||r.owner!==owner||(expected!==undefined&&JSON.stringify(r)!==JSON.stringify(expected)))return false;lessons.delete(id);return true;},
  async listSharedLessons(limit=48,offset=0){return [...lessons.values()].filter(r=>r.shared===true).sort((a,b)=>b.updatedAt-a.updatedAt||(a.id<b.id?1:-1)).slice(offset,offset+limit).map(r=>structuredClone(r));},
  async listSharedPage(limit=48,offset=0){const rows=await this.listSharedLessons(limit+1,offset);return {lessons:rows.slice(0,limit),hasMore:rows.length>limit};},
 };
}
