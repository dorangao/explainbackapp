// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
import type { Chapter, Experiment, Language } from "../frontend/lib/types";
export function chapterExperiment(
  chapter: Chapter,
  variant?: number,
  language?: Language,
  controls?: Record<string, number>,
  metric?: number,
): Experiment;
