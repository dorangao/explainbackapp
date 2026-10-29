// Fixed lesson formulas use the same bounded arithmetic language as generated lessons.
// No learner or model-provided expression is executed as JavaScript.
import { compileExpression, evaluateExpression } from './demo-model.mjs';

const expressions = {
  'crossing-primary': ['x / (x*x + 1)', 'u'],
  'crossing-transfer': ['2 + (x - 3) / (x*x + 1)', '2 + u - 3*v'],
  'crossing-alternate': ['-1 + (x + 2) / (x*x + 1)', '-1 + u + 2*v'],
  'nonzero-primary': ['(3*x*x + 1) / (x*x + 1)', '3 - 2*v'],
  'nonzero-transfer': ['(5*x*x + 2) / (2*x*x + 3)', '(5 + 2*v) / (2 + 3*v)'],
  'nonzero-alternate': ['(4*x*x + 3) / (2*x*x + 1)', '(4 + 3*v) / (2 + v)'],
  'ends-primary': ['x / sqrt(x*x + 1)', 'z1'],
  'ends-transfer': ['1 + 2*x / sqrt(x*x + 4)', '1 + 2*z2'],
  'ends-alternate': ['-2 + 3*x / sqrt(x*x + 9)', '-2 + 3*z3'],
};
const catalog = new Map(Object.entries(expressions).map(([id, [direct, scaled]]) => [
  id, {
    direct: compileExpression(direct, ['x']),
    scaled: compileExpression(scaled, ['u', 'v', 'z1', 'z2', 'z3']),
  },
]));

export function evaluate(formula, x) {
  const entry = catalog.get(formula);
  if (!entry) throw new Error('Unknown verified formula.');
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('Input must be a finite number.');
  // The generated model interpreter caps intermediate results at 1e9. Scale the
  // rational expressions for large |x| so their asymptotic behavior stays stable.
  if (Math.abs(x) <= 10_000) return evaluateExpression(entry.direct, {x});
  const hyp = Math.hypot(x, 1), inverse = 1 / hyp;
  return evaluateExpression(entry.scaled, {
    u: (x / hyp) * inverse,
    v: inverse * inverse,
    z1: x / hyp,
    z2: x / Math.hypot(x, 2),
    z3: x / Math.hypot(x, 3),
  });
}
