import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { problems, transferVariants, evaluate, publicProblem, problemPart, graphData } from '../src/problems.mjs';
import { createSession, advance, assess, learningTools, view, TURN_LIMIT } from '../src/learning.mjs';

// A well-formed model decision with the shared fields filled in; callers override what matters.
function pick(action, assessment, evidence, rest = {}) {
  return {
    action, assessment, evidence,
    feedback: 'Think about what that sentence commits you to.',
    question: 'Which value would you expect?',
    reason: 'One finite input can test the claim.',
    focus: 'concept',
    ...rest,
  };
}
// The same decision as the provider would deliver it: a native tool call with JSON arguments.
function asToolCall(decision) {
  const { action, ...args } = decision;
  return { toolCall: { name: action, arguments: JSON.stringify(args) }, model: 'fixture-model' };
}
const names = tools => tools.map(t => t.name).sort();

describe('problem catalog', () => {
  test('every function agrees with its recorded limits and crossings, and facts stay server-side', () => {
    for (const problem of Object.values(problems)) {
      const parts = [problem.primary, ...Object.values(transferVariants[problem.id])];
      for (const p of parts) {
        for (const x of p.crossings) assert.equal(evaluate(p.formula, x), p.asymptote, `${p.formula} crosses at ${x}`);
        assert.ok(Math.abs(evaluate(p.formula, 1e7) - p.rightLimit) < 1e-5, `${p.formula} right end`);
        assert.ok(Math.abs(evaluate(p.formula, -1e7) - p.leftLimit) < 1e-5, `${p.formula} left end`);
        assert.ok(p.prompt.en && p.prompt.zh, `${p.formula} is bilingual`);
      }
      assert.equal('facts' in publicProblem(problem.id, 'en'), false);
      assert.equal(publicProblem(problem.id, 'zh').title, problem.title.zh);
    }
  });
  test('variant lookup accepts the default flag and rejects unknown ids', () => {
    assert.equal(problemPart('crossing', true), transferVariants.crossing.default);
    assert.equal(problemPart('crossing'), problems.crossing.primary);
    assert.throws(() => problemPart('crossing', 'imaginary'), /variant/);
    assert.throws(() => problemPart('__proto__'), /Unknown problem/);
    assert.throws(() => publicProblem('toString'), /Unknown problem/);
  });
  test('the downward-shift variant asks about subtracting, and graph data lists both end heights once', () => {
    assert.match(publicProblem('ends', 'en', 'alternate').prompt, /subtracting 2/);
    assert.match(publicProblem('ends', 'zh', 'alternate').prompt, /减去 2/);
    assert.equal(evaluate('ends-alternate', 0), -2);
    assert.deepEqual(graphData('ends', 'alternate').asymptotes, [-5, 1]);
    assert.deepEqual(graphData('nonzero').asymptotes, [3]);
    assert.equal(graphData('crossing', 'alternate').crossings[0], -2);
  });
});

describe('offered actions', () => {
  test('a fresh session offers clarification, a prediction, a graph and a transfer, nothing more', () => {
    const s = createSession('nonzero', 'en');
    assert.deepEqual(names(learningTools(s, 'The limit is zero.')), ['ask_clarification', 'ask_prediction', 'reveal_graph', 'select_transfer']);
    assert.equal(s.attempts, 0);
    assert.equal(view(s).attemptsRemaining, TURN_LIMIT);
  });
  test('an unscoped "never touches" claim on the crossing problem leaves only clarification, in both languages', () => {
    for (const [language, words] of [['en', 'It can never touch the asymptote.'], ['zh', '曲线永远碰不到渐近线。']]) {
      assert.deepEqual(names(learningTools(createSession('crossing', language), words)), ['ask_clarification']);
    }
    // Scoped wording, or the same words on another problem, is not held back.
    assert.ok(names(learningTools(createSession('crossing', 'en'), 'It never touches it at any finite x.')).length > 1);
    assert.ok(names(learningTools(createSession('ends', 'en'), 'It never touches the asymptote.')).length > 1);
  });
  test('while a prediction is pending only clarification and the code check are offered', () => {
    const s = createSession('crossing', 'en');
    advance(s, 'The line is a wall.', pick('ask_prediction', 'misconception', 'wall', { x: 1 }));
    const tools = learningTools(s);
    assert.deepEqual(names(tools), ['ask_clarification', 'evaluate_point']);
    assert.deepEqual(tools.find(t => t.name === 'evaluate_point').parameters.properties.x.enum, [1]);
  });
  test('a completed session offers nothing', () => {
    const s = createSession('crossing', 'en');
    advance(s, 'ends only', pick('select_transfer', 'supported', 'ends only', { variantId: 'default', focus: 'transfer' }));
    advance(s, 'crosses at three', pick('compare_reasoning', 'supported', 'crosses at three', { priorEvidence: 'ends only' }));
    assert.deepEqual(learningTools(s), []);
  });
});

describe('advancing a session', () => {
  test('clarification records the turn and the next question without changing phase or pending checks', () => {
    const s = createSession('crossing', 'en');
    const shown = advance(s, 'never touches', pick('ask_clarification', 'ambiguous', 'never touches', { focus: 'meaning' }));
    assert.equal(s.phase, 'explain');
    assert.equal(s.pendingPoint, null);
    assert.equal(s.before, 'never touches');
    assert.equal(shown.probe, 'Which value would you expect?');
    assert.equal(shown.history.length, 1);
    assert.equal(shown.history[0].assessment, 'ambiguous');
    assert.deepEqual(shown.history[0].toolResult, { action: 'ask_clarification' });
  });
  test('a prediction is checked by code before any graph appears', () => {
    const s = createSession('crossing', 'en');
    advance(s, 'It is a boundary.', pick('ask_prediction', 'misconception', 'boundary', { x: 0 }));
    assert.equal(s.phase, 'revisit');
    assert.equal(s.pendingPoint, 0);
    assert.match(view(s).probe, /x = 0/);
    const checked = advance(s, 'I predict f(0) is not zero.', pick('evaluate_point', 'misconception', 'not zero', { x: 0 }));
    assert.equal(checked.observation.y, 0);
    assert.equal(checked.observation.target, 'primary');
    assert.equal(checked.graph, null);
    assert.deepEqual(checked.history.at(-1).toolResult.observation, checked.observation);
    const revealed = advance(s, 'The point contradicts a boundary.', pick('reveal_graph', 'supported', 'contradicts'));
    assert.equal(revealed.graph.formula, 'crossing-primary');
    assert.equal(revealed.graph.isReference, false);
    assert.equal(revealed.history.at(-1).toolResult.graphRevealed, true);
  });
  test('the Chinese prediction prompt names the chosen input', () => {
    const s = createSession('ends', 'zh');
    advance(s, '两端一样高。', pick('ask_prediction', 'misconception', '两端一样高', { x: -10 }));
    assert.match(view(s).probe, /x = -10/);
    assert.match(view(s).probe, /预测/);
  });
  test('a supported transfer selection switches problem text, clears observations and later compares grounded quotes', () => {
    const s = createSession('crossing', 'zh');
    const first = '有限的交点不影响两端趋近于零。';
    const transferred = advance(s, first, pick('select_transfer', 'supported', '两端趋近于零', { variantId: 'alternate', focus: 'transfer' }));
    assert.equal(s.phase, 'transfer');
    assert.equal(transferred.problem.formula, 'crossing-alternate');
    assert.equal(transferred.problem.purpose, transferVariants.crossing.alternate.purpose.zh);
    assert.equal(transferred.probe, transferVariants.crossing.alternate.prompt.zh);
    assert.equal(transferred.graph, null);
    assert.equal(transferred.history[0].toolResult.variantId, 'alternate');
    const second = '渐近线是y=-1，在x=-2穿过它；有限交点不改变两端极限。';
    const done = advance(s, second, pick('compare_reasoning', 'supported', '有限交点不改变两端极限', { priorEvidence: first }));
    assert.equal(done.phase, 'complete');
    assert.equal(s.after, second);
    assert.equal(done.graph.formula, 'crossing-alternate');
    assert.deepEqual(done.comparison, { beforeQuote: first, afterQuote: '有限交点不改变两端极限', summary: 'Think about what that sentence commits you to.', scaffolded: false });
  });
  test('a graph revealed on the primary function is marked as reference during the transfer', () => {
    const s = createSession('nonzero', 'en');
    advance(s, 'goes to three', pick('reveal_graph', 'supported', 'three'));
    advance(s, 'leading terms', pick('select_transfer', 'supported', 'leading terms', { variantId: 'default' }));
    const shown = view(s);
    assert.equal(shown.graph.formula, 'nonzero-primary');
    assert.equal(shown.graph.isReference, true);
    assert.ok(names(learningTools(s)).includes('reveal_graph'), 'the transfer graph can still be revealed');
  });
  test('help during the transfer, or a scripted demo, marks the comparison as scaffolded', () => {
    const helped = createSession('crossing', 'en');
    advance(helped, 'end behavior', pick('select_transfer', 'supported', 'end behavior', { variantId: 'default' }));
    advance(helped, 'maybe 2', pick('ask_clarification', 'ambiguous', 'maybe 2'));
    advance(helped, 'reasoned transfer', pick('compare_reasoning', 'supported', 'reasoned transfer', { priorEvidence: 'end behavior' }));
    assert.equal(helped.comparison.scaffolded, true);
    const demo = createSession('crossing', 'en');
    demo.demoUsed = true;
    advance(demo, 'end behavior', pick('select_transfer', 'supported', 'end behavior', { variantId: 'default' }));
    advance(demo, 'applied', pick('compare_reasoning', 'supported', 'applied', { priorEvidence: 'end behavior' }));
    assert.equal(demo.comparison.scaffolded, true);
    assert.equal(view(demo).demoUsed, true);
  });
});

describe('rejected decisions', () => {
  test('an unavailable action, a bad input, a premature reveal or an unsupported progression leaves the session untouched', () => {
    const s = createSession('crossing', 'en');
    const rejected = [
      pick('run_code', 'ambiguous', 'word'),
      pick('evaluate_point', 'ambiguous', 'word', { x: 0 }),
      pick('ask_prediction', 'ambiguous', 'word', { x: Infinity }),
      pick('ask_prediction', 'misconception', 'word', { x: 0.5 }),
      pick('reveal_graph', 'misconception', 'word'),
      pick('select_transfer', 'misconception', 'word', { variantId: 'default' }),
      pick('select_transfer', 'supported', 'word', { variantId: 'made-up' }),
      pick('ask_clarification', 'ambiguous', 'word', { x: 0 }),
      pick('ask_clarification', 'ambiguous', 'word', { focus: 'vibes' }),
      pick('ask_clarification', 'ambiguous', 'word', { question: '' }),
      pick('ask_clarification', 'ambiguous', 'word', { feedback: 'x'.repeat(601) }),
    ];
    for (const d of rejected) {
      const snapshot = JSON.stringify(s);
      assert.throws(() => advance(s, 'word', d), `${d.action} with ${JSON.stringify(d)}`);
      assert.equal(JSON.stringify(s), snapshot);
    }
  });
  test('an unscoped boundary claim cannot be labelled a misconception, even by a prediction request', () => {
    for (const [language, words] of [['en', 'It can never touch the asymptote.'], ['zh', '曲线永远碰不到渐近线。']]) {
      const s = createSession('crossing', language);
      assert.throws(() => advance(s, words, pick('ask_prediction', 'misconception', words, { x: 0 })));
      assert.throws(() => advance(s, words, pick('ask_clarification', 'misconception', words)));
      advance(s, words, pick('ask_clarification', 'ambiguous', words));
      assert.equal(s.history.length, 1);
    }
  });
  test('ambiguous wording never reveals a graph or selects a transfer, even after a check', () => {
    const s = createSession('crossing', 'en');
    advance(s, 'boundary', pick('ask_prediction', 'misconception', 'boundary', { x: 0 }));
    advance(s, 'zero?', pick('evaluate_point', 'ambiguous', 'zero?', { x: 0 }));
    assert.throws(() => advance(s, 'not sure', pick('reveal_graph', 'ambiguous', 'not sure')));
    assert.throws(() => advance(s, 'not sure', pick('select_transfer', 'ambiguous', 'not sure', { variantId: 'default' })));
  });
  test('the closing comparison must quote the first explanation, not a revision or an invention', () => {
    const s = createSession('crossing', 'en');
    advance(s, 'end behavior', pick('select_transfer', 'supported', 'end behavior', { variantId: 'default' }));
    advance(s, 'later wording', pick('ask_clarification', 'ambiguous', 'later wording'));
    assert.throws(() => advance(s, 'new reasoning', pick('compare_reasoning', 'supported', 'new reasoning', { priorEvidence: 'invented' })), /grounded/);
    assert.throws(() => advance(s, 'new reasoning', pick('compare_reasoning', 'supported', 'new reasoning', { priorEvidence: 'later wording' })), /grounded/);
    assert.throws(() => advance(s, 'new reasoning', pick('compare_reasoning', 'supported', 'new reasoning', { priorEvidence: '   ' })), /grounded/);
    assert.equal(s.phase, 'transfer');
  });
  test('evidence must be quoted from the current explanation', () => {
    const s = createSession('nonzero', 'en');
    assert.throws(() => advance(s, 'it goes to three', pick('ask_clarification', 'ambiguous', 'goes to zero')), /quote/);
  });
});

describe('asking the model', () => {
  test('the request separates trusted instructions, checked facts and tool results from the learner\'s words', async () => {
    const s = createSession('crossing', 'zh');
    advance(s, '边界', pick('ask_prediction', 'misconception', '边界', { x: 0 }));
    advance(s, '不是零', pick('evaluate_point', 'misconception', '不是零', { x: 0 }));
    let request;
    const decision = await assess(s, '我需要看图', async args => { request = args; return asToolCall(pick('ask_clarification', 'ambiguous', '需要看图')); });
    assert.match(request.instructions, /Chinese/);
    assert.match(request.instructions, /untrusted/);
    assert.equal(request.reasoningEffort, 'low');
    const input = JSON.parse(request.input);
    assert.equal(input.explanation, '我需要看图');
    assert.equal(input.checkedObservation.y, 0);
    assert.equal(input.originalExplanation, '边界');
    assert.equal(input.previousTurns.length, 2);
    assert.ok(input.checkedFacts.includes('f(0) = 0'));
    assert.equal(input.scopeNeedsClarification, false);
    assert.ok(names(request.tools).includes('ask_prediction'));
    assert.equal(decision.action, 'ask_clarification');
    assert.equal(decision.model, 'fixture-model');
  });
  test('an unscoped claim is flagged to the model and only clarification is sent as a tool', async () => {
    const s = createSession('crossing', 'en');
    let request;
    await assess(s, 'It can never touch the asymptote.', async args => { request = args; return asToolCall(pick('ask_clarification', 'ambiguous', 'never touch')); });
    assert.equal(JSON.parse(request.input).scopeNeedsClarification, true);
    assert.deepEqual(names(request.tools), ['ask_clarification']);
    assert.deepEqual(JSON.parse(request.input).transferOptions.map(o => o.id), ['default', 'alternate']);
  });
  test('text-only replies, unparsable arguments, smuggled fields and fabricated quotes are all refused without a trace in history', async () => {
    const s = createSession('crossing', 'zh');
    const bad = [
      { text: 'plain prose instead of a tool call', model: 'm' },
      { toolCall: { name: 'ask_clarification', arguments: '{not json' }, model: 'm' },
      { toolCall: { name: 'ask_clarification', arguments: '[]' }, model: 'm' },
      { toolCall: { name: 'ask_clarification', arguments: JSON.stringify({ ...pick('ask_clarification', 'ambiguous', '不会碰到'), action: 'reveal_graph' }) }, model: 'm' },
      asToolCall(pick('ask_clarification', 'ambiguous', 'a quote that was never written')),
      asToolCall(pick('reveal_graph', 'misconception', '不会碰到')), // nothing checked yet
    ];
    for (const reply of bad) {
      await assert.rejects(assess(s, '不会碰到', async () => reply));
      assert.equal(s.history.length, 0);
    }
  });
});

describe('session creation', () => {
  test('rejects unknown problems, languages and workflows', () => {
    assert.throws(() => createSession('calculus', 'en'), /Invalid problem/);
    assert.throws(() => createSession('crossing', 'fr'), /Invalid problem/);
    assert.throws(() => createSession('crossing', 'en', 'freestyle'), /Invalid workflow/);
    assert.throws(() => createSession('nonzero', 'en', 'claim-testing'), /Invalid workflow/);
  });
  test('claim-testing sessions are delegated to the claim workflow', () => {
    const s = createSession('crossing', 'en', 'claim-testing');
    assert.equal(s.workflow, 'claim-testing');
    assert.equal(s.phase, 'claim');
    assert.equal(view(s).phase, 'claim');
  });
});
