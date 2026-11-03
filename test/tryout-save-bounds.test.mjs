import test from 'node:test';import assert from 'node:assert/strict';
import {readLearnerTryout} from '../src/lesson-tester.mjs';
import {validateTryout} from '../src/lessons.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';

const reply=(chapters,overall='Clear enough.',rating=4)=>({toolCall:{name:'try_lesson',arguments:JSON.stringify({chapters,overall,rating})}});
const chapter=transferAnswer=>({prediction:'agree',reason:'Hot things cool.',explanation:'The gap to room temperature shrinks, so cooling slows.',transferAnswer,confusions:[],suggestions:[]});

test('a tryout report the test learner produced can always be saved with its lesson',()=>{
 const lesson=coolingLesson();
 // A wordy numeric answer is what the model may return; the reader keeps it verbatim.
 const wordy='I think it would be about twenty-one degrees after ten minutes, because the gap to the room keeps shrinking the whole time.';
 assert.ok(wordy.length>80&&wordy.length<=200);
 // The browser adds the language and model labels when it saves the report.
 const report={...readLearnerTryout(reply([chapter(wordy)]),lesson,'en'),language:'en',model:'muse-spark-1.3'};
 assert.equal(report.chapters[0].transfer.given,wordy);
 // The save validator accepts exactly what the reader produced, unit included.
 const saved=validateTryout(report,lesson);
 assert.equal(saved.chapters[0].transfer.given,wordy);assert.equal(saved.chapters[0].transfer.unit,report.chapters[0].transfer.unit);
 // A unit as long as the demo schema allows (24 characters) is also saved.
 const longUnit={...report,chapters:[{...report.chapters[0],transfer:{...report.chapters[0].transfer,unit:'x'.repeat(24)}}]};
 assert.equal(validateTryout(longUnit,lesson).chapters[0].transfer.unit,'x'.repeat(24));
 assert.throws(()=>validateTryout({...report,chapters:[{...report.chapters[0],transfer:{...report.chapters[0].transfer,unit:'x'.repeat(25)}}]},lesson));
 // Past the shared bound the reader rejects the reply instead of producing an unsaveable report.
 assert.throws(()=>readLearnerTryout(reply([chapter('9'.repeat(201))]),lesson,'en'),/Invalid tryout chapter/);
 assert.throws(()=>validateTryout({...report,chapters:[{...report.chapters[0],transfer:{...report.chapters[0].transfer,given:'9'.repeat(201)}}]},lesson));
});
