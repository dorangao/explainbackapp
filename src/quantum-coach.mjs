import {quantumCircuit} from '../public/quantum.mjs';
import {quantumLesson} from '../public/quantum-content.mjs';
const fields=['explanation','nextQuestion','focus'];
export function quantumCoachRequest(body,language){
 if(!['en','zh'].includes(language)||!['why','claim'].includes(body.question)||!['agree','disagree','unsure'].includes(body.prediction))throw new Error('Invalid quantum question.');
 const circuit=quantumCircuit(body.circuit),lesson=quantumLesson(circuit.config.lesson,language);
 return {
  instructions:`You explain an educational ideal quantum simulation. Answer only in ${language==='zh'?'Simplified Chinese':'English'}. Call explain_quantum once. Keep explanation under 130 words (under 260 Chinese characters); one specific next question. Explain the learner's chosen claim using the SERVER-CHECKED circuit facts, never invent measurements, device results, speedups or validation of independent learning. The experiment uses one/two ideal qubits on a classical computer, no noise. Amplitudes are complex; computational-basis probability is modulus squared. Measurement returns one bit string, fresh shots re-prepare. Relative phase affects interference. Bell state correlations in Z alone do not prove entanglement; the classical correlated mixture comparison in X distinguishes these examples but is not a loophole-free Bell test. No faster-than-light signaling. Grover N=4/one marked item is an exact special case; a supplied oracle marks a known checking condition, not magic discovery, and this is no runtime advantage benchmark. The response cannot alter the simulation. Choose focus only among amplitudes, probabilities, circuit.`,
  input:JSON.stringify({question:body.question,prediction:body.prediction,claim:lesson.claim,checkedExplanation:lesson.why,circuit}),
  reasoningEffort:'low',maxOutputTokens:4096,
  tools:[{type:'function',name:'explain_quantum',description:'Explain the checked circuit and suggest one next experiment.',parameters:{type:'object',properties:{explanation:{type:'string'},nextQuestion:{type:'string'},focus:{type:'string',enum:['amplitudes','probabilities','circuit']}},required:fields,additionalProperties:false},strict:true}]
 };
}
export function readQuantumCoach(result){
 if(result?.toolCall?.name!=='explain_quantum')throw new Error('Expected quantum explanation.');
 const a=JSON.parse(result.toolCall.arguments);
 if(!a||Array.isArray(a)||Object.keys(a).sort().join()!==[...fields].sort().join()||!['amplitudes','probabilities','circuit'].includes(a.focus)||typeof a.explanation!=='string'||!a.explanation.trim()||a.explanation.length>1600||typeof a.nextQuestion!=='string'||!a.nextQuestion.trim()||a.nextQuestion.length>400)throw new Error('Invalid quantum explanation.');
 return a;
}
