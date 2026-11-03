// Opt-in maintenance: removes images in Vercel Blob that no saved lesson references any more.
// Images drawn in a Studio session that was never saved stay in the store; this script
// lists blobs under images/ older than --days (default 7), collects every URL a saved
// lesson or reviewed-gallery cover override still uses, and deletes the rest. The store
// is shared by every environment that holds the same token, so references are collected
// from every environment's namespace unless --env names one.
// Usage: node --env-file=.env.local scripts/prune-blobs.mjs [--live] [--days=7] [--env=production]
import {createBlobStore} from '../src/blob.mjs';
import {createRedisClient} from '../src/redis-state.mjs';
import {referencedImages} from './prune-blobs-core.mjs';
const args=process.argv.slice(2),option=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const live=args.includes('--live'),days=Number(option('days')??7),envName=option('env')??'*';
if(!Number.isFinite(days)||days<1)throw new Error('--days must be at least 1.');
const store=createBlobStore();if(!store)throw new Error('BLOB_READ_WRITE_TOKEN is not set.');
const redis=createRedisClient({url:process.env.UPSTASH_REDIS_REST_URL??process.env.KV_REST_API_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN??process.env.KV_REST_API_TOKEN});
// Every lesson record and cover override in the chosen namespaces, whatever the credential hash.
const {referenced,records}=await referencedImages(redis,envName);
console.log(`${records} saved lessons and reviewed-gallery overrides reference ${referenced.size} images`);
const cutoff=Date.now()-days*86400000;let total=0;const stale=[];let token;
do{
 const page=await store.list({prefix:'images/',limit:1000,cursor:token});token=page.cursor;
 for(const blob of page.blobs){total++;if(!referenced.has(blob.url)&&new Date(blob.uploadedAt).getTime()<cutoff)stale.push(blob.url);}
}while(token);
console.log(`${total} stored images, ${stale.length} unreferenced and older than ${days} days`);
if(!live){console.log('Dry run; add --live to delete them.');process.exit(0);}
let removed=0;for(let i=0;i<stale.length;i+=100)removed+=await store.remove(stale.slice(i,i+100));
console.log(`deleted ${removed}`);
