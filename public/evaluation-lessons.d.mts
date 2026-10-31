// Typed surface of the generated showcase next to this file (scripts/eval-showcase.mjs).
import type {
  EvaluationComparison,
  EvaluationItem,
  Language,
} from "../frontend/lib/types";
export const evaluationLessons: readonly EvaluationItem[];
export const evaluationComparisons: readonly EvaluationComparison[];
export const evaluationIds: readonly string[];
export function evaluationLesson(id: string): EvaluationItem | null;
export function evaluationComparison(
  caseId: string,
): EvaluationComparison | null;
export function comparisonIdFromHash(hash: string | undefined): string | null;
export function evaluationModelLabel(model: string): string;
export function evaluationNote(
  item: EvaluationItem,
  language?: Language,
): string;
