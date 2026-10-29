// Shared contract: authored text, catalog references and bounded declarative models.
import {validateDemo,demoSchema} from './demo-model.mjs';
export const experimentIds=Object.freeze(['acceleration','roll','landing','suction','qubit','interference','entanglement','search']);
const shape=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...keys].sort().join('|');
// A review hint, not language certification: foreign scripts can be legitimate
// lesson subject matter. Preserve the draft so the author can inspect/revise it.
export function lessonLanguageWarnings(lesson){
 const paths=[];
 function visit(value,path=[]){
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){
   const next=[...path,key];
   if(['en','zh'].includes(key)&&typeof item==='string'&&/\p{Script=Cyrillic}/u.test(item))paths.push(next.join('.'));
   else if(item&&typeof item==='object')visit(item,next);
  }
 }
 visit(lesson);return paths;
}
// Messages name the field and limit so authors and evaluation reports see what was rejected.
function bilingual(value,max,field='text'){
 if(!shape(value,['en','zh'])||Object.values(value).some(s=>typeof s!=='string'||!s.trim()||s.length>max))throw new Error(`${field} needs both languages, each 1–${max} characters.`);
 return {en:value.en.trim(),zh:value.zh.trim()};
}
export function validateLesson(value){
 if(!shape(value,['version','title','intro','chapters'])||![1,2].includes(value.version)||!Array.isArray(value.chapters)||value.chapters.length<1||value.chapters.length>3)throw new Error('Use a version 1 or 2 lesson with 1–3 chapters.');
 const ids=new Set();
 const lesson={version:value.version,title:bilingual(value.title,80,'title'),intro:bilingual(value.intro,200,'intro'),chapters:value.chapters.map((c,i)=>{
  if(value.version===2&&c?.experiment==='generated'){
   if(!shape(c,['experiment','framing','explanation','demo']))throw new Error('Invalid generated chapter.');
   return {experiment:'generated',framing:bilingual(c.framing,180,`chapter ${i+1} framing`),explanation:bilingual(c.explanation,260,`chapter ${i+1} explanation`),demo:validateDemo(c.demo)};
  }
  if(!shape(c,['experiment','framing','explanation'])||!experimentIds.includes(c.experiment)||ids.has(c.experiment))throw new Error('Choose distinct supported experiments.');
  ids.add(c.experiment);return {experiment:c.experiment,framing:bilingual(c.framing,180,`chapter ${i+1} framing`),explanation:bilingual(c.explanation,260,`chapter ${i+1} explanation`)};
 })};
 if(new TextEncoder().encode(JSON.stringify(lesson)).length>(value.version===2?24000:12000))throw new Error('Lesson is too large.');
 return lesson;
}
export const bilingualSchema={type:'object',properties:{en:{type:'string'},zh:{type:'string'}},required:['en','zh'],additionalProperties:false};
export const lessonSchema={type:'object',properties:{version:{type:'integer',enum:[1]},title:bilingualSchema,intro:bilingualSchema,chapters:{type:'array',items:{type:'object',properties:{experiment:{type:'string',enum:experimentIds},framing:bilingualSchema,explanation:bilingualSchema},required:['experiment','framing','explanation'],additionalProperties:false}}},required:['version','title','intro','chapters'],additionalProperties:false};
export const generatedLessonSchema={type:'object',properties:{version:{type:'integer',enum:[2]},title:bilingualSchema,intro:bilingualSchema,chapters:{type:'array',items:{type:'object',properties:{experiment:{type:'string',enum:['generated']},framing:bilingualSchema,explanation:bilingualSchema,demo:demoSchema},required:['experiment','framing','explanation','demo'],additionalProperties:false}}},required:['version','title','intro','chapters'],additionalProperties:false};
