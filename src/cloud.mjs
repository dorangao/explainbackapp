import {createHandler,safeHeaders} from './server.mjs';
import {createProviderRouter} from './llm/index.mjs';
import {createRedisClient,createRedisServices} from './redis-state.mjs';
import {parseAccessCodes} from './access-codes.mjs';

export function cloudOrigins(env){
 const hosts=[env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map(h=>'https://'+h);
 const origins=new Set([...hosts,...(env.EXPLAINBACK_PUBLIC_ORIGINS??'').split(',').map(x=>x.trim()).filter(Boolean)]);
 for(const origin of origins){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw new Error('Configure HTTPS app origins.');}
 if(!origins.size)throw new Error('Configure an allowed app origin.');
 return req=>{const origin='https://'+req.headers.host;return origins.has(origin)?origin:null;};
}
export function createCloudHandler({env=process.env,command}={}){
 const accessCodes=parseAccessCodes(env.EXPLAINBACK_ACCESS_CODES);
 const services=createRedisServices({accessCodes:accessCodes.codes,command:command??createRedisClient({url:env.UPSTASH_REDIS_REST_URL??env.KV_REST_API_URL,token:env.UPSTASH_REDIS_REST_TOKEN??env.KV_REST_API_TOKEN}),namespace:`explainback:${env.VERCEL_ENV??'preview'}:v1`,username:env.EXPLAINBACK_TESTER_USERNAME,password:env.EXPLAINBACK_TESTER_PASSWORD});
 // Cloud builds deliberately cannot route to a LAN Ollama endpoint.
 const router=createProviderRouter({env:{...env,EXPLAINBACK_PROVIDERS:'meta',EXPLAINBACK_META_MODELS:'muse-spark-1.3,muse-wonder-1.0',EXPLAINBACK_DEFAULT_MODEL:'meta:muse-spark-1.3'}});
 return createHandler({...services,router,accessCodes,openAccess:false,getOrigin:cloudOrigins(env),traceEnabled:env.EXPLAINBACK_TRACE==='1',testerCredentials:{username:env.EXPLAINBACK_TESTER_USERNAME,password:env.EXPLAINBACK_TESTER_PASSWORD}});
}
export function unavailable(res){res.writeHead(503,{...safeHeaders,'Content-Type':'application/json'});res.end(JSON.stringify({error:'Cloud tester access is not configured. Check the server environment.'}));}
