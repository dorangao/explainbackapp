import {randomBytes} from 'node:crypto';
import {validateLesson} from '../public/lesson-schema.mjs';
import {decodeImageDataUrl,recordImageUrls} from './blob.mjs';
// Saved lessons: a signed-in creator (a reviewer invite or the tester account) keeps the
// lessons it made, and may share one by link. A shared lesson is readable without
// signing in; everything else stays with its owner. Records hold the checked lesson and,
// optionally, the narrated show script. Image bytes never enter the record: with Blob
// storage configured the record keeps public image URLs (cover, slide illustrations,
// source sketch); without it, images are dropped on save.
export const MAX_SAVED_PER_OWNER=50,MAX_SHARED_LISTED=48,MAX_ILLUSTRATIONS=8;
const ID=/^[a-f0-9]{16}$/,slideKinds=['cover','claim','experiment','evidence','transfer','takeaway'];
const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const bilingual=(v,max)=>v&&typeof v==='object'&&text(v.en,max)&&text(v.zh,max);
export const newLessonId=()=>randomBytes(8).toString('hex');
export const validLessonId=id=>typeof id==='string'&&ID.test(id);
// The show script must be one the show reader could have produced for this lesson.
export function validateShowScript(value,lesson){
 if(value===null||value===undefined)return null;
 if(!value||typeof value!=='object'||value.version!==1||!Array.isArray(value.slides)||value.slides.length<4||value.slides.length>9||!text(value.coverPrompt,400))throw new Error('Invalid show script.');
 const slides=value.slides.map(s=>{
  if(!s||typeof s!=='object'||!slideKinds.includes(s.kind)||!Number.isInteger(s.chapter)||s.chapter<0||s.chapter>=lesson.chapters.length||!bilingual(s.heading,80)||!bilingual(s.narration,400))throw new Error('Invalid show slide.');
  return {kind:s.kind,chapter:s.chapter,heading:{en:s.heading.en.trim(),zh:s.heading.zh.trim()},narration:{en:s.narration.en.trim(),zh:s.narration.zh.trim()}};
 });
 if(slides[0].kind!=='cover'||slides.at(-1).kind!=='takeaway')throw new Error('Invalid show order.');
 return {version:1,slides,coverPrompt:value.coverPrompt.trim()};
}
export const lessonKind=lesson=>lesson.version===1?'catalog':lesson.chapters.some(c=>c.demo?.kind==='process')&&!lesson.chapters.some(c=>c.demo?.kind==='model')?'process':'model';
// Builds the stored record from a save request. `previous` keeps the id, owner and dates
// of an existing record that the same owner updates.
export function buildSavedLesson(body,{owner,now=Date.now(),previous=null}={}){
 const lesson=validateLesson(body.lesson);
 const show=validateShowScript(body.show,lesson);
 const model=typeof body.model==='string'&&body.model.length<=80?body.model.trim():null;
 const createdAt=previous?.createdAt??now;
 const coverModel=typeof body.coverModel==='string'&&body.coverModel.length<=80?body.coverModel.trim():null;
 return {id:previous?.id??newLessonId(),owner,title:lesson.title,intro:lesson.intro,kind:lessonKind(lesson),lesson,show,model,coverModel:show?coverModel:null,cover:null,illustrations:{},sketch:null,shared:previous?.shared===true,createdAt,updatedAt:now};
}
// Resolves the images a save request references. A value is kept when it is already a
// blob URL under this owner, uploaded when it is an image data URL and a store exists,
// and dropped otherwise. Returns the URLs of the previous record that are no longer used.
export async function attachImages(record,body,{store=null,owner,previous=null}={}){
 const resolve=async value=>{
  if(value===null||value===undefined||!store)return null;
  if(typeof value!=='string')throw new Error('Invalid image.');
  if(store.owns(value,owner))return value;
  if(value.startsWith('data:'))return store.putImage({owner,...decodeImageDataUrl(value)});
  throw new Error('Invalid image.');
 };
 record.cover=record.show?await resolve(body.cover):null;
 if(!record.cover)record.coverModel=null;
 record.sketch=await resolve(body.sketch);
 record.illustrations={};
 if(body.illustrations!==undefined&&body.illustrations!==null){
  if(!body.illustrations||typeof body.illustrations!=='object'||Array.isArray(body.illustrations))throw new Error('Invalid illustrations.');
  const entries=Object.entries(body.illustrations);
  if(entries.length>MAX_ILLUSTRATIONS)throw new Error('Too many illustrations.');
  for(const [index,value] of entries){
   if(!/^[0-8]$/.test(index)||!record.show||Number(index)>=record.show.slides.length)throw new Error('Invalid illustration slide.');
   const url=await resolve(value);if(url)record.illustrations[index]=url;
  }
 }
 const kept=new Set(recordImageUrls(record));
 return recordImageUrls(previous).filter(url=>!kept.has(url));
}
// What lists and public readers see. The owner id never leaves the server.
export const lessonSummary=r=>({id:r.id,title:r.title,intro:r.intro,kind:r.kind,hasShow:Boolean(r.show),model:r.model,cover:r.cover??null,sketch:r.sketch??null,shared:r.shared===true,createdAt:r.createdAt,updatedAt:r.updatedAt});
export const publicLesson=r=>({...lessonSummary(r),lesson:r.lesson,show:r.show,coverModel:r.coverModel??null,illustrations:r.illustrations??{}});
