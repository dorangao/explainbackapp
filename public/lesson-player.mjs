import {validateLesson} from './lesson-schema.mjs';
import {chapterExperiment} from './generated-demo.mjs';
export function createLessonPlayer(input){
 const lesson=validateLesson(input);
 let state={chapter:0,stage:'predict',prediction:null,variant:0,progress:0,transfer:null,controls:{},metric:0};
 const reset=chapter=>{state={chapter,stage:'predict',prediction:null,variant:0,progress:0,transfer:null,controls:{},metric:0};};
 return {lesson,get state(){return {...state,controls:{...state.controls}};},
  experiment(language='en'){return chapterExperiment(lesson.chapters[state.chapter],state.variant,language,state.controls,state.metric);},
  input(id,value){const controls={...state.controls,[id]:value};chapterExperiment(lesson.chapters[state.chapter],state.variant,'en',controls,state.metric);const metric=state.metric,variant=state.variant;reset(state.chapter);state.controls=controls;state.metric=metric;state.variant=variant;},
  output(metric){chapterExperiment(lesson.chapters[state.chapter],state.variant,'en',state.controls,metric);state.metric=metric;},
  predict(value){if(state.stage==='predict'&&['agree','disagree','unsure'].includes(value))state.prediction=value;},
  scrub(value){if(state.stage!=='experiment'||!Number.isFinite(value))return;const steps=this.experiment().steps;state.progress=Math.round(Math.max(0,Math.min(1,value))*steps)/steps;},
  variant(value){if(![0,1].includes(value))return;const chapter=state.chapter;reset(chapter);state.variant=value;},
  check(raw){if(state.stage!=='transfer')return null;const value=typeof raw==='string'&&raw.trim()?Number(raw):NaN;if(!Number.isFinite(value))return null;const t=this.experiment().transfer;state.transfer=Math.abs(value-t.answer)<=t.tolerance;return state.transfer;},
  editAnswer(){state.transfer=null;},
  next(){
   if(state.stage==='predict'&&state.prediction){state.stage='experiment';return true;}
   if(state.stage==='experiment'&&state.progress===1){state.stage='explain';return true;}
   if(state.stage==='explain'){state.stage='transfer';return true;}
   if(state.stage==='transfer'&&state.transfer===true){if(state.chapter<lesson.chapters.length-1)reset(state.chapter+1);else state.stage='complete';return true;}
   return false;
  },
  replay(){state.stage='experiment';state.progress=0;state.transfer=null;},
  restart(){reset(0);}
 };
}
