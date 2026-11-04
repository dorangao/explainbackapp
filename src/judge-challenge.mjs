import {createHash,randomBytes,randomInt} from 'node:crypto';
import {crc32,deflateSync} from 'node:zlib';

export const CHALLENGE_TTL=5*60_000,CHALLENGE_CLIENT_LIMIT=10,CHALLENGE_GLOBAL_LIMIT=1000;
export const challengeHash=(id,answer)=>createHash('sha256').update(`${id}:${answer}`).digest('hex');
const glyphs=['11111/10001/10011/10101/11001/10001/11111','00100/01100/00100/00100/00100/00100/01110','11110/00001/00001/11110/10000/10000/11111','11110/00001/00001/01110/00001/00001/11110','10010/10010/10010/11111/00010/00010/00010','11111/10000/10000/11110/00001/00001/11110','01111/10000/10000/11110/10001/10001/01110','11111/00001/00010/00100/01000/01000/01000','01110/10001/10001/01110/10001/10001/01110','01110/10001/10001/01111/00001/00001/11110'];
// Raster pixels only: no SVG text, answer metadata, external fonts or model calls.
export function numberImage(code){
 const width=240,height=88,pixels=Buffer.alloc(width*height*3,248);
 const dot=(x,y,color)=>{x=Math.round(x);y=Math.round(y);if(x<0||x>=width||y<0||y>=height)return;for(let c=0;c<3;c++)pixels[(y*width+x)*3+c]=color[c];};
 for(let n=0;n<800;n++)dot(randomInt(width),randomInt(height),[190,208,212]);
 for(let i=0;i<code.length;i++){
  const rows=glyphs[Number(code[i])].split('/'),left=17+i*43+randomInt(5),top=24+randomInt(10),slant=(randomInt(11)-5)/20;
  rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)dot(left+x*4+sx+(y*4+sy)*slant,top+y*4+sy,[24,48,66]);}));
 }
 const raw=Buffer.alloc(height*(1+width*3));for(let y=0;y<height;y++)pixels.copy(raw,y*(1+width*3)+1,y*width*3,(y+1)*width*3);
 const chunk=(kind,data)=>{const type=Buffer.from(kind),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
export function makeJudgeChallenge(kind='image',now=Date.now()){
 const id=randomBytes(24).toString('hex'),expiresAt=now+CHALLENGE_TTL;
 if(kind==='text'){
  const a=randomInt(10,50),b=randomInt(1,10);
  return {id,expiresAt,answerHash:challengeHash(id,String(a+b)),public:{id,expiresAt,kind:'text',left:a,right:b}};
 }
 const answer=String(randomInt(10000,100000));
 return {id,expiresAt,answerHash:challengeHash(id,answer),public:{id,expiresAt,kind:'image',image:numberImage(answer)}};
}
export function memoryJudgeChallenges({now=Date.now}={}){
 const records=new Map(),buckets=new Map();
 return {
  async issueChallenge(record,client){
   for(const [id,r] of records)if(r.expiresAt<=now())records.delete(id);
   for(const [id,b] of buckets)if(b.until<=now())buckets.delete(id);
   const limits=[[client,CHALLENGE_CLIENT_LIMIT,60_000],['all',CHALLENGE_GLOBAL_LIMIT,3600_000]];
   const blocked=limits.filter(([key,limit])=>(buckets.get(key)?.count??0)>=limit);
   if(blocked.length)return {error:'JUDGE_CHALLENGE_RATE',retryAfter:Math.max(...blocked.map(([key])=>Math.ceil((buckets.get(key).until-now())/1000)))};
   for(const [key,,window] of limits){const b=buckets.get(key)??{count:0,until:now()+window};b.count++;buckets.set(key,b);}
   records.set(record.id,{client,answerHash:record.answerHash,expiresAt:record.expiresAt});return {ok:true};
  },
  async verifyChallenge(id,answerHash,client){
   const r=records.get(id);if(!r||r.client!==client)return false;
   records.delete(id);return r.expiresAt>now()&&r.answerHash===answerHash;
  },
  async resetChallengeCooldown(client){buckets.delete(client);buckets.delete('all');},
 };
}
export function redisJudgeChallenges({run,key,now=Date.now}){
 return {
  async issueChallenge(record,client){
   const outcome=await run(`
    local buckets={};local retry=0;for i=1,2 do local raw=redis.call('GET',KEYS[i]);local b=raw and cjson.decode(raw) or {count=0,untilAt=0};if b.untilAt<=tonumber(ARGV[1]) then b={count=0,untilAt=tonumber(ARGV[1])+tonumber(ARGV[3+i])} end;buckets[i]=b;if b.count>=tonumber(ARGV[1+i]) then retry=math.max(retry,b.untilAt-tonumber(ARGV[1])) end end
    if retry>0 then return {'rate',math.ceil(retry/1000)} end
    for i=1,2 do buckets[i].count=buckets[i].count+1;redis.call('SET',KEYS[i],cjson.encode(buckets[i]),'PX',math.max(1,buckets[i].untilAt-tonumber(ARGV[1]))) end
    redis.call('SET',KEYS[3],ARGV[6],'PX',ARGV[7]);return {'ok'}
   `,[key('judge-challenge-starts',client),key('judge-challenge-starts','all'),key('judge-challenge',record.id)],[now(),CHALLENGE_CLIENT_LIMIT,CHALLENGE_GLOBAL_LIMIT,60_000,3600_000,JSON.stringify({client,answerHash:record.answerHash,expiresAt:record.expiresAt}),CHALLENGE_TTL]);
   return outcome[0]==='ok'?{ok:true}:{error:'JUDGE_CHALLENGE_RATE',retryAfter:Number(outcome[1])};
  },
  async verifyChallenge(id,answerHash,client){return await run(`
   local raw=redis.call('GET',KEYS[1]);if not raw then return 0 end;local r=cjson.decode(raw);if r.client~=ARGV[1] then return 0 end
   redis.call('DEL',KEYS[1]);if r.expiresAt<=tonumber(ARGV[3]) or r.answerHash~=ARGV[2] then return 0 end;return 1
  `,[key('judge-challenge',id)],[client,answerHash,now()])===1;},
 };
}
