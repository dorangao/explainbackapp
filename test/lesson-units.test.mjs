import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateLesson, unitSystems } from '../public/lesson-schema.mjs';
import { chapterExperiment } from '../public/generated-demo.mjs';
import { coolingLesson } from '../test-support/generated-lessons.mjs';

test('a lesson may carry a default unit system for viewers, and only a known one', () => {
  assert.deepEqual([...unitSystems], ['metric', 'us']);
  const plain = validateLesson(coolingLesson());
  assert.equal('units' in plain, false);
  const us = validateLesson({ ...coolingLesson(), units: 'us' });
  assert.equal(us.units, 'us');
  assert.throws(() => validateLesson({ ...coolingLesson(), units: 'imperial' }), /metric or us/);
  assert.throws(() => validateLesson({ ...coolingLesson(), units: null }), /metric or us/);
});

test('the default unit system changes nothing the engine computes', () => {
  const base = chapterExperiment(coolingLesson().chapters[0], 0, 'en');
  const withUnits = chapterExperiment(validateLesson({ ...coolingLesson(), units: 'us' }).chapters[0], 0, 'en');
  assert.equal(withUnits.transfer.answer, base.transfer.answer);
  assert.deepEqual(withUnits.sample(0.5), base.sample(0.5));
  assert.equal(withUnits.unit, '°C');
});

test('a generated model exposes the structured pieces a display layer needs', () => {
  const e = chapterExperiment(coolingLesson().chapters[0], 0, 'zh');
  assert.equal(e.axisLabel, '时间');
  assert.equal(e.axisUnit, 'min');
  assert.equal(e.xAt(0.5), 15);
  assert.equal(e.outputLabel, '温度');
  assert.ok(e.result.startsWith(e.resultPrefix));
  assert.equal(e.transferQuestion, '用以下新参数计算温度。');
  assert.deepEqual(e.transferInputs.map(p => [p.label, p.value, p.unit]), [['初始温度', 90, '°C'], ['室温', 20, '°C'], ['冷却系数', 0.1, '1/min']]);
  assert.equal(e.transferAt, 10);
  assert.equal(e.transferOutputLabel, '温度');
  // The combined strings the player shows are built from exactly those pieces.
  assert.equal(e.transfer.question, `${e.transferQuestion}\n初始温度 = 90 °C · 室温 = 20 °C · 冷却系数 = 0.1 1/min\n时间 = 10 min → 温度`);
  const process = chapterExperiment({ experiment: 'generated', framing: { en: 'f', zh: 'f' }, explanation: { en: 'e', zh: 'e' }, demo: { kind: 'process', title: { en: 't', zh: 't' }, claim: { en: 'c', zh: 'c' }, assumptions: { en: 'a', zh: 'a' }, stages: [{ title: { en: 's1', zh: 's1' }, detail: { en: 'd1', zh: 'd1' } }, { title: { en: 's2', zh: 's2' }, detail: { en: 'd2', zh: 'd2' } }, { title: { en: 's3', zh: 's3' }, detail: { en: 'd3', zh: 'd3' } }], transfer: { question: { en: 'q', zh: 'q' }, choices: [{ en: 'a', zh: 'a' }, { en: 'b', zh: 'b' }, { en: 'c', zh: 'c' }], answer: 0, rationale: { en: 'r', zh: 'r' } } } }, 0, 'en');
  assert.equal(process.axisLabel, undefined, 'process lessons have nothing to convert');
});
