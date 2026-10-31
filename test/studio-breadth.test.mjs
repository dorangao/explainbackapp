import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadStudioSuite, decodeStudioSuite, scoreStudioCase } from '../src/eval/studio.mjs';
import { coolingLesson, processLesson } from '../test-support/generated-lessons.mjs';

const ready = lesson => ({ structured: { name: 'compose_lesson', value: { status: 'ready', message: { en: 'Ready', zh: '已就绪' }, lesson } } });
const declined = { structured: { name: 'compose_lesson', value: { status: 'unsupported', message: { en: 'Not a bounded teachable model.', zh: '不是可教学的有界模型。' }, lesson: null } } };
const byId = (suite, id) => suite.cases.find(c => c.id === id);

test('the breadth suite is frozen: twelve bilingual pairs across domains, learner-phrased topics, no specifications', () => {
  const { suite, sha256 } = loadStudioSuite('studio-breadth-v1');
  assert.equal(suite.cases.length, 24);
  const pairs = [...new Set(suite.cases.map(c => c.pair))];
  assert.equal(pairs.length, 12);
  for (const pair of pairs) assert.deepEqual(suite.cases.filter(c => c.pair === pair).map(c => c.language), ['en', 'zh']);
  assert.deepEqual(
    suite.cases.reduce((n, c) => ({ ...n, [c.category]: (n[c.category] ?? 0) + 1 }), {}),
    { model: 18, process: 4, unsupported: 2 },
  );
  // Breadth tests knowledge, not instruction following: no case dictates input ids or probes.
  for (const c of suite.cases) {
    assert.equal(c.expected.inputIds, undefined, c.id);
    assert.equal(c.expected.probes, undefined, c.id);
    assert.ok(Array.isArray(c.expected.review) && c.expected.review.length >= 2, c.id);
    assert.ok(c.topic.length <= 600 && c.topic.trim(), c.id);
  }
  const raw = readFileSync(new URL('../eval/studio-breadth-v1.json', import.meta.url), 'utf8');
  assert.throws(() => decodeStudioSuite(raw.replace('45 degrees', '46 degrees'), sha256), /checksum/i);
});

test('model cases pass on contract, renderer kind and a unit-labelled output, and fail on the wrong unit family', () => {
  const { suite } = loadStudioSuite('studio-breadth-v1');
  // half-life names no unit family: any unit-labelled output of a valid model lesson passes.
  const open = scoreStudioCase(byId(suite, 'half-life-en'), ready(coolingLesson()));
  assert.equal(open.contractValid, true);
  assert.equal(open.automatedPass, true);
  assert.equal(open.checks.outputUnit, true);
  assert.equal(open.manualReview, 'required');
  // projectile expects a distance; a °C output is a valid lesson but the wrong quantity.
  const wrongFamily = scoreStudioCase(byId(suite, 'projectile-en'), ready(coolingLesson()));
  assert.equal(wrongFamily.contractValid, true);
  assert.equal(wrongFamily.automatedPass, false);
  assert.equal(wrongFamily.checks.expectedUnit, false);
  // A dimensionless-only model does not count as a unit-labelled answer.
  const dimensionless = coolingLesson();
  dimensionless.chapters[0].demo.outputs[0].unit = '1';
  assert.equal(scoreStudioCase(byId(suite, 'half-life-en'), ready(dimensionless)).checks.outputUnit, false);
  // Units are matched after trimming, so ' m ' counts as a distance for projectile.
  const padded = coolingLesson();
  padded.chapters[0].demo.outputs[0].unit = ' m ';
  assert.equal(scoreStudioCase(byId(suite, 'projectile-en'), ready(padded)).checks.expectedUnit, true);
  // Two chapters are tolerated; three are not.
  const two = coolingLesson(); two.chapters.push(structuredClone(two.chapters[0]));
  assert.equal(scoreStudioCase(byId(suite, 'half-life-en'), ready(two)).checks.chapters, true);
  const three = coolingLesson(); three.chapters.push(structuredClone(three.chapters[0]), structuredClone(three.chapters[0]));
  const tooMany = scoreStudioCase(byId(suite, 'half-life-en'), ready(three));
  assert.equal(tooMany.checks.chapters, false);
  assert.equal(tooMany.automatedPass, false);
});

test('process and declined cases are scored by renderer kind and status, never by content', () => {
  const { suite } = loadStudioSuite('studio-breadth-v1');
  assert.equal(scoreStudioCase(byId(suite, 'vaccine-immunity-zh'), ready(processLesson())).automatedPass, true);
  assert.equal(scoreStudioCase(byId(suite, 'vaccine-immunity-zh'), ready(coolingLesson())).automatedPass, false);
  assert.equal(scoreStudioCase(byId(suite, 'stock-pick-en'), declined).automatedPass, true);
  assert.equal(scoreStudioCase(byId(suite, 'stock-pick-en'), ready(coolingLesson())).automatedPass, false);
  assert.equal(scoreStudioCase(byId(suite, 'rc-charging-zh'), declined).automatedPass, false);
});
