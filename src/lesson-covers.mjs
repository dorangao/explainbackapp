import {ILLUSTRATION_STYLE} from './lesson-show.mjs';
import {galleryLessons} from '../public/gallery-lessons.mjs';
import {evaluationLessons} from '../public/evaluation-lessons.mjs';
// Library covers for reviewed lessons: one picture Muse Image draws from a lesson's English
// title and introduction. scripts/lesson-covers.mjs draws them into the shipped manifest;
// the Create-side route draws one at a signed-in creator's request and keeps it in the
// app's state, where it wins over the manifest for every visitor. Same prompt either way.
export const coverPromptVersion='cover-v1';
const clip=(text,max)=>text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
export function coverPrompt(lesson){
 return clip(`${ILLUSTRATION_STYLE} Subject: ${clip(lesson.title.en,120)}. ${clip(lesson.intro.en,400)}`,1000);
}
// Every lesson a cover can be drawn for: the reviewed gallery and the evaluation showcase.
export const coverableLessons=()=>[...galleryLessons.map(item=>({id:item.id,lesson:item.lesson})),...evaluationLessons.map(item=>({id:item.id,lesson:item.lesson}))];
export const coverLesson=id=>coverableLessons().find(item=>item.id===id)?.lesson??null;
export function coverTargets({evaluation=false,ids=[]}={}){
 const all=coverableLessons();
 const wanted=new Set([...(evaluation?evaluationLessons.map(item=>item.id):[]),...ids]);
 const missing=[...wanted].filter(id=>!all.some(item=>item.id===id));
 if(missing.length)throw new Error(`Unknown lesson ids: ${missing.join(', ')}.`);
 return all.filter(item=>wanted.has(item.id));
}
// What the library may read about a creator-drawn cover: never who asked for it.
export const publicCover=c=>({src:c.src,model:c.model,createdAt:c.createdAt,promptVersion:c.promptVersion});
