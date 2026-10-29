// Small live smoke evaluation; not the planned independent 24–30-case review.
import { writeFile } from 'node:fs/promises';
import { callMeta } from '../src/meta.mjs';
import { createSession, assess } from '../src/learning.mjs';

const cases = [
  { id: 'crossing-en-ambiguous', problem: 'crossing', language: 'en', expected: 'ambiguous', expectedAction: 'ask_clarification', text: 'It can never touch the asymptote.' },
  { id: 'crossing-zh-ambiguous', problem: 'crossing', language: 'zh', expected: 'ambiguous', expectedAction: 'ask_clarification', text: '曲线永远碰不到渐近线。' },
  { id: 'nonzero-en-supported', problem: 'nonzero', language: 'en', expected: 'supported', text: 'The limit is 3. Divide numerator and denominator by x squared: (3+1/x²)/(1+1/x²), whose vanishing terms leave 3/1.' },
  { id: 'nonzero-zh-misconception', problem: 'nonzero', language: 'zh', expected: 'misconception', text: '极限是零，因为分母趋于无穷大。不管分子如何变化，分母无穷大就一定让分式趋于零。' },
  { id: 'ends-en-supported', problem: 'ends', language: 'en', expected: 'supported', text: 'The limit at positive infinity is 1, and at negative infinity it is -1. Since sqrt(x²)=|x|, the leading ratio is x/|x|, so its sign differs between the ends.' },
  { id: 'ends-zh-supported', problem: 'ends', language: 'zh', expected: 'supported', text: '正无穷处的极限是1，负无穷处是-1。因为根号下x的平方开方等于绝对值x，所以主要比值为x/|x|，两端的符号不同。' },
];
const results = [];
for (const item of cases) {
  try {
    const response = await assess(createSession(item.problem, item.language), item.text,
      args => callMeta({ ...args, apiKey: process.env.MODEL_API_KEY, model: process.env.META_MODEL || undefined }));
    const actual = response.assessment;
    const pass = actual === item.expected && (!item.expectedAction || response.action === item.expectedAction);
    results.push({ id: item.id, expected: item.expected, actual, action: response.action, pass, model: response.model });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${item.id}: ${actual} / ${response.action}`);
  } catch {
    results.push({ id: item.id, expected: item.expected, pass: false, error: 'API request or feedback validation failed' });
    console.log(`FAIL ${item.id}: API request or feedback validation failed`);
  }
}
await writeFile(new URL('../docs/local-evaluation.json', import.meta.url), JSON.stringify({ syntheticExamplesOnly: true, evaluatedAt: new Date().toISOString(), results }, null, 2) + '\n');
if (results.some(r => !r.pass)) process.exitCode = 1;
