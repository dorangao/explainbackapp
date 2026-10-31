// The evaluation card is rendered inside the app from docs/evaluation.md; showcase lessons
// and comparisons link to that page. The published folder is where its sibling reports live.
export const EVALUATION_CARD_HASH = "#evaluation";
export const REPO_URL = "https://github.com/dorangao/explainbackapp";
export const EVALUATION_DOCS_URL =
  "https://github.com/dorangao/explainbackapp/blob/main/docs/";
export const EVALUATION_CARD_URL = `${EVALUATION_DOCS_URL}evaluation.md`;
// Rubric items in the order the judge reports them (src/eval/judge.mjs, studio-judge-v1).
export const RUBRIC_ITEMS = [
  "neutralFraming",
  "quantityNames",
  "transferClarity",
  "bilingualParity",
  "assumptions",
] as const;
export type RubricItem = (typeof RUBRIC_ITEMS)[number];
