import {isBlobUrl,recordImageUrls} from '../src/blob.mjs';

// Collect live references across credential rotations within one deployment environment.
export async function referencedImages(redis,envName){
 const referenced=new Set();let cursor='0',records=0;
 do{
  const [next,keys]=await redis(['SCAN',cursor,'MATCH',`explainback:${envName}:v1:*:lesson:*`,'COUNT','200']);cursor=String(next);
  if(keys.length){const values=await redis(['MGET',...keys]);for(const value of values){
   // A missing key can result from a concurrent delete; malformed data cannot safely
   // establish which images it references, so stop before any live deletion.
   if(value===null)continue;
   const record=JSON.parse(value);if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Invalid saved lesson record.');
   records++;for(const url of recordImageUrls(record))referenced.add(url);
  }}
 }while(cursor!=='0');
 // Reviewed gallery covers are held in a hash in each credential namespace, rather
 // than in saved lesson records. Include them before deciding which blobs are stale.
 cursor='0';
 do{
  const [next,keys]=await redis(['SCAN',cursor,'MATCH',`explainback:${envName}:v1:*:covers:`,'COUNT','200']);cursor=String(next);
  for(const key of keys){
   const flat=await redis(['HGETALL',key]);
   if(!Array.isArray(flat)||flat.length%2!==0)throw new Error('Invalid gallery cover index.');
   for(let i=1;i<flat.length;i+=2){
    const cover=JSON.parse(flat[i]);
    if(!cover||typeof cover!=='object'||typeof cover.src!=='string')throw new Error('Invalid gallery cover record.');
    if(isBlobUrl(cover.src))referenced.add(cover.src);
   }
  }
 }while(cursor!=='0');
 return {referenced,records};
}
