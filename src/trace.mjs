// Opt-in diagnostics. Storage receives only redacted snapshots, never credentials.
export function createTrace(secret='',{initial=[],onChange}={}) {
 const secrets=(Array.isArray(secret)?secret:[secret]).filter(s=>typeof s==='string'&&s);
 let rows=structuredClone(initial),sequence=Math.max(0,...initial.map(r=>r.sequence));
 let pending=Promise.resolve(),writeError;
 const changed=()=>{if(onChange){const copy=structuredClone(rows);pending=pending.then(()=>onChange(copy)).catch(error=>{writeError=error;});}};
 function clean(value,budget={left:60000}) {
  if(typeof value==='string'){
   const redacted=secrets.reduce((text,key)=>text.split(key).join('[REDACTED]'),value);
   const n=Math.max(0,budget.left);budget.left-=Math.min(n,redacted.length);
   return redacted.length>n?redacted.slice(0,n)+'…[truncated]':redacted;
  }
  if(Array.isArray(value))return value.slice(0,100).map(v=>clean(v,budget));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,100).filter(([k])=>!['authorization','headers','apiKey','api_key','cookie','reasoning','thinking','encrypted_content'].includes(k)).map(([k,v])=>[k,clean(v,budget)]));
  return value;
 }
 return {
  start(request){
   const start=Date.now(),row={sequence:++sequence,provider:request.provider??'meta',model:request.model,startedAt:new Date(start).toISOString(),durationMs:0,outcome:'pending',requestSent:false,request:clean(request),response:null,httpStatus:null};
   rows.push(row);if(rows.length>12)rows.shift();changed();
   return {
    event(event){
     if(event.type==='lifecycle'){row.lifecycle??=[];row.lifecycle.push(clean({action:event.action,model:event.model}));}
     if(event.type==='request'){row.requestSent=true;row.request=clean(event.body);}
     if(event.type==='response'){row.httpStatus=event.status;row.response=clean(event.body);}
     if(event.type==='error'){row.httpStatus=event.status??null;row.error=clean(event.message);}
     changed();
    },
    finish(outcome,reason){row.outcome=outcome;row.durationMs=Date.now()-start;if(typeof reason==='string'&&reason)row.reason=clean(reason);changed();},
   };
  },
  read:()=>structuredClone(rows),clear:()=>{rows=[];changed();},
  async flush(){await pending;if(writeError)throw writeError;},
 };
}
