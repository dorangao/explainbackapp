import {randomBytes} from 'node:crypto';
import {validateLesson} from '../public/lesson-schema.mjs';
import {decodeImageDataUrl,recordImageUrls} from './blob.mjs';
import {maxShowSlides} from './lesson-show.mjs';
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
 if(!value||typeof value!=='object'||value.version!==1||!Array.isArray(value.slides)||value.slides.length<4||value.slides.length>maxShowSlides(lesson)||!text(value.coverPrompt,400))throw new Error('Invalid show script.');
 const slides=value.slides.map(s=>{
  if(!s||typeof s!=='object'||!slideKinds.includes(s.kind)||!Number.isInteger(s.chapter)||s.chapter<0||s.chapter>=lesson.chapters.length||!bilingual(s.heading,80)||!bilingual(s.narration,400))throw new Error('Invalid show slide.');
  if(s.illustrate!==undefined&&typeof s.illustrate!=='boolean')throw new Error('Invalid show slide.');
  return {kind:s.kind,chapter:s.chapter,heading:{en:s.heading.en.trim(),zh:s.heading.zh.trim()},narration:{en:s.narration.en.trim(),zh:s.narration.zh.trim()},...(s.illustrate===true?{illustrate:true}:{})};
 });
 if(slides[0].kind!=='cover'||slides.at(-1).kind!=='takeaway')throw new Error('Invalid show order.');
 return {version:1,slides,coverPrompt:value.coverPrompt.trim()};
}
// The test learner's report, as the tryout reader produced it, so reopening a saved
// lesson shows how Spark did without a new request. Checked answers are recomputed by
// the client from the lesson, so only the model's text and the given answers are kept.
const list=(v,max,each)=>Array.isArray(v)&&v.length<=max&&v.every(s=>typeof s==='string'&&s.length<=each);
const optional=(v,max)=>v===null||v===undefined?null:typeof v==='string'&&v.length<=max?v.trim():undefined;
export function validateTryout(value,lesson){
 if(value===null||value===undefined)return null;
 if(!value||typeof value!=='object'||!Array.isArray(value.chapters)||value.chapters.length!==lesson.chapters.length||!text(value.overall,400)||!Number.isInteger(value.rating)||value.rating<1||value.rating>5||!['en','zh'].includes(value.language))throw new Error('Invalid tryout.');
 const model=optional(value.model,80);if(model===undefined)throw new Error('Invalid tryout.');
 const chapters=value.chapters.map(c=>{
  if(!c||typeof c!=='object'||!['agree','disagree','unsure'].includes(c.prediction)||!text(c.reason,300)||!text(c.explanation,600)||!list(c.confusions,3,200)||!list(c.suggestions,3,200))throw new Error('Invalid tryout chapter.');
  const tr=c.transfer;
  if(!tr||typeof tr!=='object'||typeof tr.given!=='string'||tr.given.length>80||typeof tr.correct!=='boolean'||!['number','choice'].includes(tr.type))throw new Error('Invalid tryout transfer.');
  const unit=optional(tr.unit,20),choice=optional(tr.choice,200);if(unit===undefined||choice===undefined)throw new Error('Invalid tryout transfer.');
  return {prediction:c.prediction,reason:c.reason.trim(),explanation:c.explanation.trim(),transfer:{given:tr.given.trim(),correct:tr.correct,type:tr.type,...(unit?{unit}:{}),...(choice!==null?{choice}:{})},confusions:c.confusions,suggestions:c.suggestions};
 });
 return {chapters,overall:value.overall.trim(),rating:value.rating,model,language:value.language};
}
// Explain-back grades: the learner's own explanation per chapter with Spark's verdict
// and feedback. `key` is the client's cache fingerprint, kept so a reopened grade is
// marked fresh or stale against the live lesson state exactly as before.
export function validateGrades(value,lesson){
 if(value===null||value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid grades.');
 const entries=Object.entries(value);if(entries.length>lesson.chapters.length)throw new Error('Too many grades.');
 const out={};
 for(const [index,g] of entries){
  if(!/^[0-9]$/.test(index)||Number(index)>=lesson.chapters.length||!g||typeof g!=='object')throw new Error('Invalid grade.');
  if(!text(g.explanation,700)||!text(g.feedback,700)||!['supported','partly','unsupported'].includes(g.verdict)||!['en','zh'].includes(g.language)||typeof g.key!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(g.key))throw new Error('Invalid grade.');
  const followUp=optional(g.followUp,300),model=optional(g.model,80);if(followUp===undefined||model===undefined)throw new Error('Invalid grade.');
  out[index]={explanation:g.explanation.trim(),feedback:g.feedback.trim(),verdict:g.verdict,followUp,model,language:g.language,key:g.key};
 }
 return out;
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
 const tryout=validateTryout(body.tryout,lesson),grades=validateGrades(body.grades,lesson);
 if(body.reviewed!==undefined&&typeof body.reviewed!=='boolean')throw new Error('Invalid reviewed flag.');
 // The creator's own review of the definition and assumptions, as of this save.
 const reviewedAt=body.reviewed===true?now:null;
 return {id:previous?.id??newLessonId(),owner,reviewedAt,title:lesson.title,intro:lesson.intro,kind:lessonKind(lesson),lesson,show,model,coverModel:show?coverModel:null,cover:null,illustrations:{},sketch:null,tryout,grades,shared:previous?.shared===true,createdAt,updatedAt:now};
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
 // A cover drawn for this saved lesson (Draw a cover on the Create page) outlives saves
 // that carry no show cover; a show cover sent with the save replaces it.
 const keepDrawn=previous?.coverDrawn===true&&Boolean(previous.cover)&&(body.cover===undefined||body.cover===null||body.cover===previous.cover);
 record.cover=keepDrawn?previous.cover:(record.show?await resolve(body.cover):null);
 record.coverDrawn=keepDrawn;
 if(keepDrawn)record.coverModel=previous.coverModel??null;
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
export const lessonSummary=r=>({id:r.id,title:r.title,intro:r.intro,kind:r.kind,hasShow:Boolean(r.show),hasTryout:Boolean(r.tryout),graded:Object.keys(r.grades??{}).length,model:r.model,cover:r.cover??null,coverModel:r.coverModel??null,sketch:r.sketch??null,shared:r.shared===true,reviewedAt:r.reviewedAt??null,currency:r.lesson?.currency??null,createdAt:r.createdAt,updatedAt:r.updatedAt});
export const publicLesson=r=>({...lessonSummary(r),lesson:r.lesson,show:r.show,illustrations:r.illustrations??{},tryout:r.tryout??null,grades:r.grades??{}});
