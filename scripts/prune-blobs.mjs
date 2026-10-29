// Opt-in maintenance: removes images in Vercel Blob that no saved lesson references any more.
// Images drawn in a Studio session that was never saved stay in the store; this script
// lists blobs under images/ older than --days (default 7), collects every URL a saved
// lesson still uses by scanning the Redis lesson keys, and deletes the rest.
// Usage: node --env-file=.env.local scripts/prune-blobs.mjs [--live] [--days=7] [--env=production]
import {createBlobStore,recordImageUrls} from '../src/blob.mjs';
import {createRedisClient} from '../src/redis-state.mjs';
const args=process.argv.slice(2),option=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const live=args.includes('--live'),days=Number(option('days')??7),envName=option('env')??process.env.VERCEL_ENV??'production';
if(!Number.isFinite(days)||days<1)throw new Error('--days must be at least 1.');
const store=createBlobStore();if(!store)throw new Error('BLOB_READ_WRITE_TOKEN is not set.');
const redis=createRedisClient({url:process.env.UPSTASH_REDIS_REST_URL??process.env.KV_REST_API_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN??process.env.KV_REST_API_TOKEN});
// Every lesson record in this environment's namespace, whatever the credential hash.
const referenced=new Set();let cursor='0',records=0;
do{
 const [next,keys]=await redis(['SCAN',cursor,'MATCH',`explainback:${envName}:v1:*:lesson:*`,'COUNT','200']);cursor=String(next);
 if(keys.length){const values=await redis(['MGET',...keys]);for(const value of values){try{const record=JSON.parse(value);records++;for(const url of recordImageUrls(record))referenced.add(url);}catch{}}}
}while(cursor!=='0');
console.log(`${records} saved lessons reference ${referenced.size} images`);
const cutoff=Date.now()-days*86400000;let total=0;const stale=[];let token;
do{
 const page=await store.list({prefix:'images/',limit:1000,cursor:token});token=page.cursor;
 for(const blob of page.blobs){total++;if(!referenced.has(blob.url)&&new Date(blob.uploadedAt).getTime()<cutoff)stale.push(blob.url);}
}while(token);
console.log(`${total} stored images, ${stale.length} unreferenced and older than ${days} days`);
if(!live){console.log('Dry run; add --live to delete them.');process.exit(0);}
let removed=0;for(let i=0;i<stale.length;i+=100)removed+=await store.remove(stale.slice(i,i+100));
console.log(`deleted ${removed}`);
