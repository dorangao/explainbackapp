import {randomUUID} from 'node:crypto';
export const SESSION_TTL=30*60_000;
export const LOCK_TTL=90_000; // Longer than the cloud provider's 30-second timeout.
export const snapshot=s=>structuredClone(Object.fromEntries(Object.entries(s).filter(([k])=>k!=='trace')));

// Local development adapter. The cloud adapter implements the same contract in Redis.
export function createMemoryState({now=Date.now}={}){
 const sessions=new Map(),traces=new Map(),locks=new Map(),turns=new Map();
 // Hourly provider budgets per bucket: 'global' for tester logins, 'code:<label>' per access code.
 const counter=bucket=>{const c=turns.get(bucket);if(c&&now()-c.window<60*60_000)return c;const fresh={count:0,window:now()};turns.set(bucket,fresh);return fresh;};
 const remove=id=>{sessions.delete(id);traces.delete(id);locks.delete(id);};
 const prune=()=>{for(const [id,s] of sessions)if(now()-s.createdAt>=SESSION_TTL&&!locks.has(id))remove(id);};
 const owns=(id,token)=>sessions.has(id)&&locks.get(id)?.token===token;
 return {
  async create(id,s){prune();if(sessions.size>=100)return false;sessions.set(id,snapshot(s));return true;},
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
 };
}
