// The evaluation card is rendered inside the app from docs/evaluation.md; showcase lessons
// and comparisons link to that page. Dated run reports are kept in the private repository.
export const EVALUATION_CARD_HASH = "#evaluation";
export const REPO_URL = "https://github.com/dorangao/explainbackapp";
// Where a reader reports a creator-shared lesson: a prefilled issue on the public
// repository, which needs no address and keeps the report visible. The body names the
// lesson's link so the author can find and unshare it.
export function reportLessonUrl(id: string, title: string): string {
  const link = `https://explainback.app/#shared:${id}`;
  const params = new URLSearchParams({
    title: `Report shared lesson: ${title} (${id})`,
    body: `Lesson: ${link}\n\nWhat is wrong with it (wrong figures, unsafe advice, something that should not be public):\n\n`,
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
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
