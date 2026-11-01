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
// A creator may set the unit system viewers see first ('metric' as authored, or 'us'); the
// browser converts numbers for display and the computation stays in the authored units.
export const unitSystems=Object.freeze(['metric','us']);
// Sources a grounded draft relied on: a few public https pages with a title. Decorative
// provenance for the reader; nothing in the lesson is computed from them.
export const MAX_SOURCES=6;
function validateSources(value){
 if(!Array.isArray(value)||value.length<1||value.length>MAX_SOURCES)throw new Error(`sources is a list of 1–${MAX_SOURCES} pages.`);
 const seen=new Set();
 return value.map(s=>{
  let url;try{url=new URL(s?.url);}catch{throw new Error('Each source needs an https URL.');}
  if(!shape(s,['url','title'])||s.url.length>300||url.protocol!=='https:'||url.username||url.password||typeof s.title!=='string'||!s.title.trim()||s.title.length>200||seen.has(s.url))throw new Error('Each source needs a distinct https URL and a title under 200 characters.');
  seen.add(s.url);return {url:s.url,title:s.title.trim()};
 });
}
export function validateLesson(value){
 const base=['version','title','intro','chapters'];
 const extras=value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value).filter(k=>!base.includes(k)):[];
 if(!shape(value,[...base,...extras])||extras.some(k=>!['units','sources','currency'].includes(k))||![1,2].includes(value.version)||!Array.isArray(value.chapters)||value.chapters.length<1||value.chapters.length>3)throw new Error('Use a version 1 or 2 lesson with 1–3 chapters.');
 const withUnits=extras.includes('units'),withSources=extras.includes('sources');
 if(withUnits&&!unitSystems.includes(value.units))throw new Error('units must be metric or us.');
 const sources=withSources?validateSources(value.sources):null;
 const currency=extras.includes('currency')?validateCurrency(value.currency):null;
 const ids=new Set();
 const lesson={version:value.version,...(withUnits?{units:value.units}:{}),...(sources?{sources}:{}),...(currency?{currency}:{}),title:bilingual(value.title,80,'title'),intro:bilingual(value.intro,200,'intro'),chapters:value.chapters.map((c,i)=>{
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
// The author's lesson schema with a required sources list of URL strings, used only when
// references were supplied; the server maps the strings back to titled sources.
// The author's mark on a generated lesson: "stable" when it rests on constants and
// relationships that do not change, "dated" when a figure it names changes over time.
// The server stamps asOf with the drafting date; the author only chooses the status.
export const currencyStatuses=Object.freeze(['stable','dated']);
function validateCurrency(value){
 if(!shape(value,['status','asOf'])||!currencyStatuses.includes(value.status)||typeof value.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.asOf))throw new Error('currency needs a status (stable or dated) and an asOf date.');
 return {status:value.status,asOf:value.asOf};
}
export const withCurrency=schema=>({...schema,properties:{...schema.properties,currency:{type:'string',enum:[...currencyStatuses]}},required:[...(schema.required??[]),'currency']});
export const withSources=schema=>({...schema,properties:{...schema.properties,sources:{type:'array',items:{type:'string'}}},required:[...(schema.required??[]),'sources']});
export const lessonSchema={type:'object',properties:{version:{type:'integer',enum:[1]},title:bilingualSchema,intro:bilingualSchema,chapters:{type:'array',items:{type:'object',properties:{experiment:{type:'string',enum:experimentIds},framing:bilingualSchema,explanation:bilingualSchema},required:['experiment','framing','explanation'],additionalProperties:false}}},required:['version','title','intro','chapters'],additionalProperties:false};
export const generatedLessonSchema={type:'object',properties:{version:{type:'integer',enum:[2]},title:bilingualSchema,intro:bilingualSchema,chapters:{type:'array',items:{type:'object',properties:{experiment:{type:'string',enum:['generated']},framing:bilingualSchema,explanation:bilingualSchema,demo:demoSchema},required:['experiment','framing','explanation','demo'],additionalProperties:false}}},required:['version','title','intro','chapters'],additionalProperties:false};
