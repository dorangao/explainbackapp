import {createHash,timingSafeEqual} from 'node:crypto';
// Reviewer access codes: EXPLAINBACK_ACCESS_CODES="label:CODE:YYYY-MM-DD:quota,label2:CODE2:YYYY-MM-DD:quota".
// A code signs in without the tester password, carries its own hourly provider budget,
// expires at the end of its date (UTC) and is revoked by removing it from the environment.
const LABEL=/^[a-z0-9][a-z0-9-]{0,31}$/,CODE=/^[A-Za-z0-9-]{8,64}$/,DATE=/^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_CODE_QUOTA=500;
const digest=value=>createHash('sha256').update(value).digest();
export const normalizeCode=value=>typeof value==='string'?value.trim().toUpperCase():'';
export function parseAccessCodes(raw,{now=Date.now}={}){
 const codes=[],warnings=[],labels=new Set();
 if(typeof raw!=='string'||!raw.trim())return {codes,warnings};
 raw.split(',').map(s=>s.trim()).filter(Boolean).forEach((entry,i)=>{
  const parts=entry.split(':');
  if(parts.length!==4){warnings.push(`entry ${i+1}: expected label:code:YYYY-MM-DD:quota`);return;}
  const [label,code,date,quotaText]=parts.map(s=>s.trim()),match=DATE.exec(date),quota=Number(quotaText);
  if(!LABEL.test(label)||labels.has(label)){warnings.push(`entry ${i+1}: invalid or duplicate label`);return;}
  if(!CODE.test(code)){warnings.push(`entry ${i+1}: code needs 8–64 letters, digits or hyphens`);return;}
  if(!match){warnings.push(`entry ${i+1}: expiry must be YYYY-MM-DD`);return;}
  const expiresAt=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])+1);
  if(!Number.isFinite(expiresAt)||expiresAt<=now()){warnings.push(`entry ${i+1}: already expired`);return;}
  if(!Number.isInteger(quota)||quota<1||quota>MAX_CODE_QUOTA){warnings.push(`entry ${i+1}: quota must be 1–${MAX_CODE_QUOTA}`);return;}
  labels.add(label);codes.push(Object.freeze({label,code:normalizeCode(code),hash:digest(normalizeCode(code)).toString('hex'),expiresAt,quota}));
 });
 return {codes:Object.freeze(codes),warnings};
}
// Compare against every configured code so timing does not reveal which one matched.
export function findAccessCode(codes,value,now=Date.now()){
 const probe=digest(normalizeCode(value));let found=null;
 for(const entry of codes){if(timingSafeEqual(probe,digest(entry.code))&&entry.expiresAt>now)found=entry;}
 return found;
}
// Session audience: what a cookie remembers about the code it was issued for.
export const audienceOf=entry=>({label:entry.label,hash:entry.hash,quota:entry.quota,expiresAt:entry.expiresAt});
export const audienceValid=(codes,audience,now=Date.now())=>Boolean(audience)&&codes.some(c=>c.label===audience.label&&c.hash===audience.hash&&c.expiresAt>now)&&audience.expiresAt>now;
export const budgetFor=audience=>audience?[`code:${audience.label}`,audience.quota]:['global',60];
export const publicAudience=audience=>audience?{label:audience.label,quota:audience.quota,expiresAt:audience.expiresAt}:null;
