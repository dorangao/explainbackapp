import {evaluationCases} from './cases.mjs';
export function selectCases(value){
 const cases=evaluationCases();if(value===undefined)return cases;
 const ids=value.split(',');
 if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!cases.some(c=>c.id===id)))throw new Error('Choose distinct known case IDs for --cases.');
 return ids.map(id=>cases.find(c=>c.id===id));
}
