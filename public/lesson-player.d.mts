// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
import type { Lesson, Player } from "../frontend/lib/types";
export function createLessonPlayer(input: Lesson | unknown): Player;
