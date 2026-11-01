import type { Lesson } from "./types";
import { fingerprint } from "./studio-cache";
import { withoutUnits } from "./units";

export type WorkspaceArea = "home" | "create" | "tryout";
export type TryoutUI = {
  answer: string;
  result: boolean | "invalid" | null;
  observation?: { state: unknown; outcome: number } | null;
  counts?: number[] | null;
};
export const emptyTryoutUI: TryoutUI = { answer: "", result: null };
// A title or display-unit change does not alter the experiment or learner task.
export function attemptKey(lesson: Lesson) {
  const { title: _title, ...content } = withoutUnits(lesson);
  return fingerprint(content);
}
