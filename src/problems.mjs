// The three fixed asymptote problems the baseline coach teaches, each with a primary function
// and two transfer functions, their checked limits and crossings, and the bilingual prompts.
// Every function is evaluated by the shared bounded catalog (public/formula-catalog.mjs);
// nothing in this module runs learner or model text as code.
import { evaluate } from '../public/formula-catalog.mjs';
export { evaluate };

const text = (en, zh) => ({ en, zh });

// One function the learner reasons about: where its ends go, where (if anywhere) it meets
// its asymptote at a finite input, the plotting window, and what is asked of the learner.
function part(formula, expression, ends, prose) {
  const { left, right, crossings = [], range, asymptote = right } = ends;
  return { formula, expression, asymptote, leftLimit: left, rightLimit: right, crossings, range, ...prose };
}

const crossingPrimary = part('crossing-primary', 'f(x) = x / (x² + 1)', { left: 0, right: 0, crossings: [0], range: [-0.7, 0.7] }, {
  prompt: text(
    'The horizontal asymptote of f is y = 0. Does the graph ever meet it, or pass from one side to the other? Say what an asymptote actually promises.',
    'f 的水平渐近线是 y = 0。图像会不会碰到它，甚至从一侧穿到另一侧？说说渐近线到底保证了什么。',
  ),
  probe: text(
    'Work out f(0). How does that value sit with the idea that an asymptote is a line the curve can never reach?',
    '算一算 f(0)。这个值和“渐近线是曲线永远到不了的线”这个想法相符吗？',
  ),
  facts: 'As x tends to +∞ or −∞ the value tends to 0. f(0) = 0, so the graph passes through the asymptote at x = 0. A horizontal asymptote describes behaviour far out, not a barrier at finite inputs; a supported explanation keeps finite inputs and end behaviour apart.',
});
const crossingTransfer = part('crossing-transfer', 'g(x) = 2 + (x − 3) / (x² + 1)', { left: 2, right: 2, crossings: [3], range: [-2, 4] }, {
  prompt: text(
    'Name the horizontal asymptote of g. Does g cross it? Give the x where it does, and explain why that does not contradict the limit.',
    '写出 g 的水平渐近线。g 会穿过它吗？给出穿过时的 x，并解释这为什么不与极限矛盾。',
  ),
  facts: '(x − 3)/(x² + 1) tends to 0 at both ends, so the asymptote is y = 2, and it is crossed at x = 3. A supported answer names y = 2 and x = 3 and keeps a finite crossing apart from end behaviour.',
});
const nonzeroPrimary = part('nonzero-primary', 'f(x) = (3x² + 1) / (x² + 1)', { left: 3, right: 3, range: [0, 4] }, {
  prompt: text(
    'For very large x, does f(x) head toward 0, toward 3, or somewhere else? Argue from how fast the top and the bottom grow.',
    '当 x 很大时，f(x) 趋向 0、趋向 3，还是别的值？请从分子和分母各自增长的快慢来论证。',
  ),
  probe: text(
    'Divide the top and the bottom by x² (for x ≠ 0). Which pieces fade away, and which stay?',
    '把分子和分母同时除以 x²（x ≠ 0）。哪些部分会消失，哪些会留下？',
  ),
  facts: 'Both end limits are 3, not 0: after dividing by x² the ratio is (3 + 1/x²)/(1 + 1/x²), and equal degrees leave the ratio of leading coefficients. f(0) = 1, and since f(x) = 3 − 2/(x² + 1) the curve never reaches 3. A supported answer gives 3 with a growth or leading-coefficient argument.',
});
const nonzeroTransfer = part('nonzero-transfer', 'g(x) = (5x² + 2) / (2x² + 3)', { left: 2.5, right: 2.5, range: [0, 3.5] }, {
  prompt: text(
    'Find the limit of g as x → ∞, and explain why a denominator that keeps growing does not drive this ratio to zero.',
    '求 x → ∞ 时 g 的极限，并解释为什么分母一直变大并不会把这个比值压到零。',
  ),
  facts: 'The limit is 5/2, that is 2.5: divide top and bottom by x²; both have degree 2, so the leading coefficients remain. A supported answer gives 5/2 with a valid growth argument.',
});
const endsPrimary = part('ends-primary', 'f(x) = x / √(x² + 1)', { left: -1, right: 1, range: [-1.5, 1.5] }, {
  prompt: text(
    'Work out the limits of f as x → ∞ and as x → −∞. Must the two ends settle at the same height?',
    '分别求 x → ∞ 和 x → −∞ 时 f 的极限。两端一定会停在同一高度吗？',
  ),
  probe: text(
    'When x is negative, is √(x²) the same as x, or as |x|? Try x = −10 and look at each end on its own.',
    'x 为负时，√(x²) 等于 x 还是 |x|？代入 x = −10，再分别看两端。',
  ),
  facts: 'The right-hand limit is 1 and the left-hand limit is −1, because √(x²) = |x| makes x/|x| change sign between the ends. A supported explanation gives both limits and the absolute-value reasoning.',
});
const endsTransfer = part('ends-transfer', 'g(x) = 1 + 2x / √(x² + 4)', { left: -1, right: 3, range: [-2, 4] }, {
  prompt: text(
    'Find both end limits of g, and explain how the sign of x shapes the result before the 1 is added.',
    '求 g 两端的极限，并解释在加上 1 之前 x 的正负如何决定结果。',
  ),
  facts: 'Right-hand limit 3, left-hand limit −1: 2x/√(x² + 4) tends to 2 on the right and −2 on the left, since √(x²) = |x|. A supported answer gives both values with the sign reasoning.',
});

export const problems = {
  crossing: { id: 'crossing', title: text('Can an asymptote be crossed?', '渐近线能被穿过吗？'), primary: crossingPrimary, transfer: crossingTransfer },
  nonzero: { id: 'nonzero', title: text('Does every fraction approach zero?', '分式的极限一定是零吗？'), primary: nonzeroPrimary, transfer: nonzeroTransfer },
  ends: { id: 'ends', title: text('Do both ends behave the same?', '两端的行为一样吗？'), primary: endsPrimary, transfer: endsTransfer },
};

// Two verified transfer functions per problem. "default" is the problem's own transfer; the
// alternate changes the sign or the shift so the coach can test the gap the learner showed.
export const transferVariants = {
  crossing: {
    default: { ...crossingTransfer, purpose: text('Check a crossing that is not at the origin.', '检验一个不在原点的穿越点。') },
    alternate: part('crossing-alternate', 'g(x) = −1 + (x + 2) / (x² + 1)', { left: -1, right: -1, crossings: [-2], range: [-3, 2] }, {
      purpose: text('Try the same idea with a negative asymptote and a negative crossing point.', '用负的渐近线和负的穿越点再试同一想法。'),
      prompt: crossingTransfer.prompt,
      facts: 'Both limits are −1, since (x + 2)/(x² + 1) tends to 0, and the crossing is at x = −2. A supported answer names y = −1 and x = −2 and separates finite crossings from end behaviour.',
    }),
  },
  nonzero: {
    default: { ...nonzeroTransfer, purpose: text('Use a leading-coefficient ratio that is not a whole number.', '用一个不是整数的首项系数比。') },
    alternate: part('nonzero-alternate', 'g(x) = (4x² + 3) / (2x² + 1)', { left: 2, right: 2, range: [1, 4] }, {
      purpose: text('Keep the value at zero apart from the end limit.', '把 x = 0 处的值和无穷远处的极限区分开。'),
      prompt: nonzeroTransfer.prompt,
      facts: 'Both limits are 2: dividing by x² gives (4 + 3/x²)/(2 + 1/x²). g(0) = 3 is not the limit, and the curve never equals 2. A supported answer gives 2 with growth or leading-coefficient reasoning.',
    }),
  },
  ends: {
    default: { ...endsTransfer, purpose: text('Sort out the sign first, then the upward shift.', '先弄清正负，再加上向上的平移。') },
    alternate: part('ends-alternate', 'g(x) = −2 + 3x / √(x² + 9)', { left: -5, right: 1, range: [-6, 2] }, {
      purpose: text('Follow the sign through a stretch and a downward shift.', '在拉伸和向下平移中追踪正负号。'),
      prompt: text(
        'Find both end limits of g, and explain how the sign of x shapes the ratio before subtracting 2.',
        '求 g 两端的极限，并解释在减去 2 之前 x 的正负如何决定比值。',
      ),
      facts: 'Right-hand limit 1, left-hand limit −5: 3x/√(x² + 9) tends to 3 on the right and −3 on the left because √(x²) = |x|, and then 2 is subtracted. A supported answer gives both limits with sign reasoning.',
    }),
  },
};

const known = id => Object.hasOwn(problems, id);

// The part a session is working on: the primary function, or the named transfer variant.
// `true` selects the default transfer so callers can pass a plain flag.
export function problemPart(id, variantId = null) {
  if (!known(id)) throw new Error('Unknown problem.');
  if (!variantId) return problems[id].primary;
  const wanted = variantId === true ? 'default' : variantId;
  if (!Object.hasOwn(transferVariants[id], wanted)) throw new Error('Unknown transfer variant.');
  return transferVariants[id][wanted];
}

// What the browser may see: the question in one language, never the checked facts.
export function publicProblem(id, language = 'en', transfer = false) {
  if (!known(id)) throw new Error('Unknown problem.');
  const current = problemPart(id, transfer);
  return {
    id,
    title: problems[id].title[language],
    expression: current.expression,
    prompt: current.prompt[language],
    formula: current.formula,
    purpose: current.purpose?.[language] ?? null,
  };
}

// Plot description for a revealed graph: the formula id the browser evaluates through the
// catalog, the window, and the checked limits and crossings to draw as reference lines.
export function graphData(id, transfer = false) {
  const current = problemPart(id, transfer);
  const { formula, expression, range, leftLimit, rightLimit, crossings } = current;
  return { formula, expression, range, asymptotes: [...new Set([leftLimit, rightLimit])], crossings, leftLimit, rightLimit };
}
