// Live smoke check of the baseline coach against the configured Meta model: six synthetic
// explanations with the assessment (and, where it matters, the action) we expect back. One
// request per case, no retries. This is a developer check, not the independent evaluation.
import { writeFile } from 'node:fs/promises';
import { callMeta } from '../src/meta.mjs';
import { createSession, assess } from '../src/learning.mjs';

const CASES = [
  { id: 'crossing-en-ambiguous', problem: 'crossing', language: 'en', expect: { assessment: 'ambiguous', action: 'ask_clarification' },
    text: 'The curve never touches the asymptote.' },
  { id: 'crossing-zh-ambiguous', problem: 'crossing', language: 'zh', expect: { assessment: 'ambiguous', action: 'ask_clarification' },
    text: '这条曲线永远不会碰到渐近线。' },
  { id: 'nonzero-en-supported', problem: 'nonzero', language: 'en', expect: { assessment: 'supported' },
    text: 'It tends to 3: dividing everything by x² leaves (3 + 1/x²) over (1 + 1/x²), and the 1/x² pieces vanish, so 3 over 1.' },
  { id: 'nonzero-zh-misconception', problem: 'nonzero', language: 'zh', expect: { assessment: 'misconception' },
    text: '极限等于零。分母会无限增大，而只要分母无限大，不管分子怎样，整个分式都趋于零。' },
  { id: 'ends-en-supported', problem: 'ends', language: 'en', expect: { assessment: 'supported' },
    text: 'At +∞ the limit is 1 and at −∞ it is −1: sqrt(x²) is |x|, so the leading ratio is x/|x|, which has opposite signs at the two ends.' },
  { id: 'ends-zh-supported', problem: 'ends', language: 'zh', expect: { assessment: 'supported' },
    text: '趋向正无穷时极限是 1，趋向负无穷时是 −1。因为 √(x²) = |x|，主要部分是 x/|x|，两端符号相反。' },
];

const meta = args => callMeta({ ...args, apiKey: process.env.MODEL_API_KEY, model: process.env.META_MODEL || undefined });
const results = [];
for (const c of CASES) {
  let row;
  try {
    const decision = await assess(createSession(c.problem, c.language), c.text, meta);
    const pass = decision.assessment === c.expect.assessment && (!c.expect.action || decision.action === c.expect.action);
    row = { id: c.id, expected: c.expect.assessment, actual: decision.assessment, action: decision.action, pass, model: decision.model };
    console.log(`${pass ? 'PASS' : 'FAIL'} ${c.id}: ${decision.assessment} / ${decision.action}`);
  } catch {
    // Upstream errors and rejected decisions are reported the same way; details stay out of the log.
    row = { id: c.id, expected: c.expect.assessment, pass: false, error: 'request failed or the decision was rejected' };
    console.log(`FAIL ${c.id}: request failed or the decision was rejected`);
  }
  results.push(row);
}
const report = { syntheticExamplesOnly: true, evaluatedAt: new Date().toISOString(), results };
await writeFile(new URL('../docs/local-evaluation.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = results.every(r => r.pass) ? 0 : 1;
