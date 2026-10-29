// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
import type { Lesson } from "../frontend/lib/types";
export const experimentIds: readonly string[];
export function validateLesson(value: unknown): Lesson;
export function lessonLanguageWarnings(lesson: unknown): string[];
export const bilingualSchema: Record<string, unknown>;
export const lessonSchema: Record<string, unknown>;
export const generatedLessonSchema: Record<string, unknown>;
