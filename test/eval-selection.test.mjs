import {test} from 'node:test';import assert from 'node:assert/strict';
import {selectCases} from '../src/eval/select-cases.mjs';
test('focused eval retains canonical cases and rejects typos or duplicate selection',()=>{
 assert.equal(selectCases().length,8);
 const cases=selectCases('crossing-ambiguity-en,crossing-ambiguity-zh');assert.deepEqual(cases.map(c=>c.language),['en','zh']);assert.ok(cases.every(c=>c.expected.action==='ask_clarification'));
 for(const ids of ['', 'missing', 'crossing-ambiguity-en,', 'crossing-ambiguity-en,crossing-ambiguity-en'])assert.throws(()=>selectCases(ids));
});
