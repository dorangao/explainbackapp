import { evaluate } from '../public/formula-catalog.mjs';
export { evaluate };
const pair = (en, zh) => ({ en, zh });
export const problems = {
  crossing: {
    id: 'crossing', title: pair('Can an asymptote be crossed?', '渐近线能被穿过吗？'),
    primary: { formula: 'crossing-primary', expression: 'f(x) = x / (x² + 1)', asymptote: 0, leftLimit: 0, rightLimit: 0, crossings: [0], range: [-0.7, 0.7],
      prompt: pair('The horizontal asymptote is y = 0. Can the curve ever touch or cross it? Explain what the asymptote tells you.', '水平渐近线是 y = 0。曲线能接触或穿过它吗？请解释渐近线描述了什么。'),
      probe: pair('Calculate f(0). What does this tell you about the claim that an asymptote is an uncrossable boundary?', '计算 f(0)。这能说明“渐近线是不能穿过的边界”这个说法有什么问题？'),
      facts: 'Both limits as x tends to positive/negative infinity are 0. f(0)=0. It crosses y=0 at x=0. An asymptote describes end behavior, not a boundary. A correct explanation must distinguish finite x from end behavior.',
    },
    transfer: { formula: 'crossing-transfer', expression: 'g(x) = 2 + (x − 3) / (x² + 1)', asymptote: 2, leftLimit: 2, rightLimit: 2, crossings: [3], range: [-2, 4],
      prompt: pair('Find the horizontal asymptote. Can g cross it? Give the crossing x-value and explain why crossing is consistent with the limit.', '求水平渐近线。g 能穿过它吗？给出交点的 x 值，并解释这为什么不违背极限。'),
      facts: 'Both limits are 2 because (x-3)/(x²+1) tends to 0. The horizontal asymptote is y=2. It crosses at x=3. A supported answer must give y=2, x=3 and distinguish end behavior from finite input.',
    },
  },
  nonzero: {
    id: 'nonzero', title: pair('Does every fraction approach zero?', '分式的极限一定是零吗？'),
    primary: { formula: 'nonzero-primary', expression: 'f(x) = (3x² + 1) / (x² + 1)', asymptote: 3, leftLimit: 3, rightLimit: 3, crossings: [], range: [0, 4],
      prompt: pair('As x grows without bound, does f(x) approach 0, 3, or something else? Explain using the growth of both numerator and denominator.', '当 x 无限增大时，f(x) 趋近于 0、3，还是其他值？结合分子和分母的增长解释。'),
      probe: pair('Divide every term in the numerator and denominator by x² (for x ≠ 0). Which terms vanish, and which remain?', '当 x ≠ 0 时，把分子和分母的每一项都除以 x²。哪些项趋于零，哪些项保留下来？'),
      facts: 'Both limits are 3, not 0. Dividing by x² gives (3+1/x²)/(1+1/x²). Equal degree leaves the ratio of leading coefficients. f(0)=1, f(x)=3-2/(x²+1), so it never equals 3. A supported answer needs limit 3 and growth/leading-coefficient reasoning.',
    },
    transfer: { formula: 'nonzero-transfer', expression: 'g(x) = (5x² + 2) / (2x² + 3)', asymptote: 2.5, leftLimit: 2.5, rightLimit: 2.5, crossings: [], range: [0, 3.5],
      prompt: pair('Find the limit as x → ∞ and explain why the growing denominator does not make this ratio approach zero.', '求 x → ∞ 时的极限，并解释为什么分母不断增大不代表整个分式趋于零。'),
      facts: 'The limit is 5/2, or 2.5. Divide both numerator and denominator by x². Both have degree 2, so the ratio of leading coefficients remains. Supported answer requires 5/2 and a valid growth argument.',
    },
  },
  ends: {
    id: 'ends', title: pair('Do both ends behave the same?', '两端的行为一样吗？'),
    primary: { formula: 'ends-primary', expression: 'f(x) = x / √(x² + 1)', asymptote: 1, leftLimit: -1, rightLimit: 1, crossings: [], range: [-1.5, 1.5],
      prompt: pair('Find the limits as x → ∞ and x → −∞. Explain whether the two ends must approach the same height.', '分别求 x → ∞ 和 x → −∞ 时的极限。解释两端是否必须趋近于同一个高度。'),
      probe: pair('For negative x, is √(x²) equal to x or |x|? Try x = −10, then reconsider each end separately.', '当 x 为负数时，√(x²) 等于 x 还是 |x|？试试 x = −10，再分别考虑两端。'),
      facts: 'The right-hand end limit is 1; left-hand end limit is -1. sqrt(x²)=|x|, so x/|x| has different signs at the two ends. Supported explanation needs both limits and the absolute-value/sign reasoning.',
    },
    transfer: { formula: 'ends-transfer', expression: 'g(x) = 1 + 2x / √(x² + 4)', asymptote: 3, leftLimit: -1, rightLimit: 3, crossings: [], range: [-2, 4],
      prompt: pair('Find both end limits for g. Explain how the sign of x affects the result before adding 1.', '求 g 两端的极限。解释在加 1 之前，x 的正负如何影响结果。'),
      facts: 'The right-hand end limit is 3; left-hand end limit is -1. The ratio 2x/sqrt(x²+4) approaches 2 on the right and -2 on the left because sqrt(x²)=|x|. Supported answer needs both values and sign reasoning.',
    },
  },
};

export const transferVariants = {
  crossing: {
    default: { ...problems.crossing.transfer, purpose: pair('Test a crossing away from the origin.', '检验不在原点的交点。') },
    alternate: { formula: 'crossing-alternate', expression: 'g(x) = −1 + (x + 2) / (x² + 1)', asymptote: -1, leftLimit: -1, rightLimit: -1, crossings: [-2], range: [-3, 2],
      purpose: pair('Test the same idea with a negative asymptote and negative crossing input.', '用负的渐近线高度和负的交点检验同一概念。'),
      prompt: problems.crossing.transfer.prompt,
      facts: 'Both limits are -1 because (x+2)/(x²+1) tends to 0. It crosses y=-1 at x=-2. A supported answer needs y=-1, x=-2 and a distinction between finite crossings and end behavior.' },
  },
  nonzero: {
    default: { ...problems.nonzero.transfer, purpose: pair('Use a non-integer ratio of leading coefficients.', '应用非整数的首项系数比。') },
    alternate: { formula: 'nonzero-alternate', expression: 'g(x) = (4x² + 3) / (2x² + 1)', asymptote: 2, leftLimit: 2, rightLimit: 2, crossings: [], range: [1, 4],
      purpose: pair('Separate the end limit from the value at zero.', '区分无穷远处的极限与零点的函数值。'),
      prompt: problems.nonzero.transfer.prompt,
      facts: 'Both limits are 2. Divide by x² to obtain (4+3/x²)/(2+1/x²). g(0)=3 is not the end limit. The curve never equals 2. A supported answer needs 2 and leading-coefficient/growth reasoning.' },
  },
  ends: {
    default: { ...problems.ends.transfer, purpose: pair('Apply the sign change before a vertical shift.', '先处理符号变化，再处理竖直平移。') },
    alternate: { formula: 'ends-alternate', expression: 'g(x) = −2 + 3x / √(x² + 9)', asymptote: 1, leftLimit: -5, rightLimit: 1, crossings: [], range: [-6, 2],
      purpose: pair('Track the sign through a scale and a negative shift.', '在倍数和负向平移中追踪正负号。'),
      prompt: pair('Find both end limits for g. Explain how the sign of x affects the ratio before subtracting 2.', '求 g 两端的极限。解释在减去 2 之前，x 的正负如何影响比值。'),
      facts: 'At positive infinity the limit is 1; at negative infinity it is -5. The ratio 3x/sqrt(x²+9) tends to 3 on the right and -3 on the left since sqrt(x²)=|x|; subtract 2 afterward. A supported answer needs both limits and sign/absolute-value reasoning.' },
  },
};

export function problemPart(id, variantId = null) {
  if (!Object.hasOwn(problems, id)) throw new Error('Unknown problem.');
  if (!variantId) return problems[id].primary;
  const key = variantId === true ? 'default' : variantId;
  if (!Object.hasOwn(transferVariants[id], key)) throw new Error('Unknown transfer variant.');
  return transferVariants[id][key];
}

export function publicProblem(id, language = 'en', transfer = false) {
  if (!Object.hasOwn(problems, id)) throw new Error('Unknown problem.');
  const p = problems[id];
  const part = problemPart(id, transfer);
  return { id, title: p.title[language], expression: part.expression, prompt: part.prompt[language], formula: part.formula, purpose: part.purpose?.[language] ?? null };
}

export function graphData(id, transfer = false) {
  const part = problemPart(id, transfer);
  return { formula: part.formula, expression: part.expression, range: part.range,
    asymptotes: [...new Set([part.leftLimit, part.rightLimit])], crossings: part.crossings,
    leftLimit: part.leftLimit, rightLimit: part.rightLimit };
}
