import {randomBytes} from 'node:crypto';
import {validateLesson} from '../public/lesson-schema.mjs';
// Saved lessons: a signed-in creator (a reviewer invite or the tester account) keeps the
// lessons it made, and may share one by link. A shared lesson is readable without
// signing in; everything else stays with its owner. Records hold the checked lesson and,
// optionally, the narrated show script; cover image bytes are never stored.
export const MAX_SAVED_PER_OWNER=50,MAX_SHARED_LISTED=48;
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
 return {id:previous?.id??newLessonId(),owner,title:lesson.title,intro:lesson.intro,kind:lessonKind(lesson),lesson,show,model,shared:previous?.shared===true,createdAt,updatedAt:now};
}
// What lists and public readers see. The owner id never leaves the server.
export const lessonSummary=r=>({id:r.id,title:r.title,intro:r.intro,kind:r.kind,hasShow:Boolean(r.show),model:r.model,shared:r.shared===true,createdAt:r.createdAt,updatedAt:r.updatedAt});
export const publicLesson=r=>({...lessonSummary(r),lesson:r.lesson,show:r.show});
