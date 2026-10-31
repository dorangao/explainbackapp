// Where the evaluation card lives; the app links to it from showcase lessons and comparisons.
export const EVALUATION_CARD_URL =
  "https://github.com/dorangao/explainbackapp/blob/main/docs/evaluation.md";
// Rubric items in the order the judge reports them (src/eval/judge.mjs, studio-judge-v1).
export const RUBRIC_ITEMS = [
  "neutralFraming",
  "quantityNames",
  "transferClarity",
  "bilingualParity",
  "assumptions",
] as const;
export type RubricItem = (typeof RUBRIC_ITEMS)[number];
