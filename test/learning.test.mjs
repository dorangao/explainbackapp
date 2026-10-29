import assert from 'node:assert/strict';
import { test } from 'node:test';
import { problems, transferVariants, evaluate, publicProblem } from '../src/problems.mjs';
import { createSession, advance, assess, learningTools, view } from '../src/learning.mjs';

const decision = (action, assessment, evidence, extra = {}) => ({ action, assessment, evidence,
  feedback: 'Consider the meaning of that statement.', question: 'What would you predict?',
  reason: 'A finite input can test this claim.', focus: 'concept', ...extra });
const toolResponse = d => ({ toolCall: { name: d.action, arguments: JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k])=>k!=='action'))) }, model: 'test-model' });

test('every primary and transfer variant matches its checked limits and crossings', () => {
  for (const p of Object.values(problems)) {
    for (const part of [p.primary, ...Object.values(transferVariants[p.id])]) {
      for (const x of part.crossings) assert.equal(evaluate(part.formula, x), part.asymptote);
      assert.ok(Math.abs(evaluate(part.formula, 1e7) - part.rightLimit) < 1e-5);
      assert.ok(Math.abs(evaluate(part.formula, -1e7) - part.leftLimit) < 1e-5);
    }
    assert.equal('facts' in publicProblem(p.id, 'en'), false);
  }
});

test('the negative-shift transfer asks for subtraction rather than the default addition', () => {
  assert.match(publicProblem('ends','en','alternate').prompt,/subtracting 2/);
  assert.match(publicProblem('ends','zh','alternate').prompt,/减去 2/);
  assert.equal(evaluate('ends-alternate',0),-2);
});

test('clarification does not force a numerical probe or advance the topic', () => {
  const s = createSession('crossing','en');
  advance(s,'never touches',decision('ask_clarification','ambiguous','never touches',{focus:'meaning'}));
  assert.equal(s.phase,'explain');
  assert.equal(s.nextStep.action,'ask_clarification');
  assert.equal(s.pendingPoint,null);
  assert.equal(view(s).probe,'What would you predict?');
});

test('unscoped never-touch claims require clarification before a misconception label', async () => {
  for(const [language,text] of [['en','It can never touch the asymptote.'],['zh','曲线永远碰不到渐近线。']]) {
    const s=createSession('crossing',language);
    assert.throws(()=>advance(s,text,decision('ask_prediction','misconception',text,{x:0})));
    let request;
    await assess(s,text,async args=>{request=args;return toolResponse(decision('ask_clarification','ambiguous',text));});
    assert.deepEqual(request.tools.map(t=>t.name),['ask_clarification']);
  }
});

test('a selected prediction is checked deterministically before graph reveal', () => {
  const s = createSession('crossing','en');
  advance(s,'It is a boundary.',decision('ask_prediction','misconception','boundary',{x:0}));
  assert.equal(s.pendingPoint,0);
  assert.equal(s.showGraph,false);
  assert.equal(learningTools(s).some(t=>t.name==='evaluate_point'),true);
  advance(s,'I predict f(0) is not zero.',decision('evaluate_point','misconception','not zero',{x:0}));
  assert.equal(s.observation.y,0);
  assert.equal(s.showGraph,false);
  advance(s,'The point contradicts a boundary.',decision('reveal_graph','supported','contradicts'));
  assert.equal(s.showGraph,true);
  assert.equal(view(s).graph.formula,'crossing-primary');
});

test('Muse selects a verified alternate transfer, then compares grounded quotes', () => {
  const s = createSession('crossing','zh');
  const first='有限的交点不影响两端趋近于零。';
  advance(s,first,decision('select_transfer','supported','两端趋近于零',{variantId:'alternate',focus:'transfer'}));
  assert.equal(s.phase,'transfer');
  assert.equal(s.transferId,'alternate');
  assert.equal(view(s).problem.formula,'crossing-alternate');
  assert.equal(view(s).graph,null);
  const after='渐近线是y=-1，在x=-2穿过它；有限交点不改变两端极限。';
  advance(s,after,decision('compare_reasoning','supported','有限交点不改变两端极限',{priorEvidence:'有限的交点不影响两端趋近于零。'}));
  assert.equal(s.phase,'complete');
  assert.equal(s.after,after);
  assert.equal(view(s).graph.formula,'crossing-alternate');
  assert.equal(s.comparison.beforeQuote,first);
});

test('invalid tool names, invalid point arguments and premature reveals leave state unchanged', () => {
  const s=createSession('crossing','en');
  for(const d of [decision('run_code','ambiguous','word'),decision('evaluate_point','ambiguous','word',{x:0}),
    decision('ask_prediction','ambiguous','word',{x:Infinity}),decision('reveal_graph','misconception','word'),
    decision('select_transfer','misconception','word',{variantId:'default'}),decision('select_transfer','supported','word',{variantId:'made-up'})]) {
    const before=JSON.stringify(s);
    assert.throws(()=>advance(s,'word',d));
    assert.equal(JSON.stringify(s),before);
  }
});

test('ambiguous wording cannot cause a reveal or transfer even after a previous check', () => {
  const s=createSession('crossing','en');
  advance(s,'boundary',decision('ask_prediction','misconception','boundary',{x:0}));
  advance(s,'zero?',decision('evaluate_point','ambiguous','zero?',{x:0}));
  assert.throws(()=>advance(s,'not sure',decision('reveal_graph','ambiguous','not sure')));
  assert.throws(()=>advance(s,'not sure',decision('select_transfer','ambiguous','not sure',{variantId:'default'})));
});

test('fabricated quotes, malformed arguments, and text-only model output fail closed', async () => {
  const s=createSession('crossing','zh');
  for(const response of [{text:'not a tool call'}, {toolCall:{name:'ask_clarification',arguments:'not JSON'}},
    toolResponse(decision('ask_clarification','ambiguous','invented quote'))]) {
    await assert.rejects(assess(s,'不会碰到',async()=>response));
    assert.equal(s.history.length,0);
  }
});

test('completion cannot quote a fabricated original explanation', () => {
  const s=createSession('crossing','en');
  advance(s,'end behavior',decision('select_transfer','supported','end behavior',{variantId:'default'}));
  assert.throws(()=>advance(s,'new reasoning',decision('compare_reasoning','supported','new reasoning',{priorEvidence:'invented'})),/grounded/);
  assert.equal(s.phase,'transfer');
});

test('transfer clarification is recorded as scaffolding in the final comparison', () => {
  const s=createSession('crossing','en');
  advance(s,'end behavior',decision('select_transfer','supported','end behavior',{variantId:'default'}));
  advance(s,'maybe 2',decision('ask_clarification','ambiguous','maybe 2'));
  advance(s,'reasoned transfer',decision('compare_reasoning','supported','reasoned transfer',{priorEvidence:'end behavior'}));
  assert.equal(s.comparison.scaffolded,true);
});

test('model receives real tool results and bilingual instructions separately from untrusted input', async () => {
  const s=createSession('crossing','zh');
  advance(s,'边界',decision('ask_prediction','misconception','边界',{x:0}));
  advance(s,'不是零',decision('evaluate_point','misconception','不是零',{x:0}));
  let request;
  const result=await assess(s,'我需要看图',async args=>{request=args;return toolResponse(decision('ask_clarification','ambiguous','需要看图'));});
  assert.match(request.instructions,/Chinese/);
  assert.match(request.instructions,/untrusted/);
  assert.equal(JSON.parse(request.input).checkedObservation.y,0);
  assert.ok(request.tools.some(t=>t.name==='ask_prediction'));
  assert.equal(result.action,'ask_clarification');
});
