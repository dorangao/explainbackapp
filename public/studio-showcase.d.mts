// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
import type { Language } from "../frontend/lib/types";
export function areaFromHash(hash: string): "physics" | "quantum" | "studio";
export function studioWalkthrough(
  language?: Language,
  kind?: "model" | "process",
): {
  title: string;
  steps: { title: string; detail: string }[];
  topic: string;
  revision: string;
  operate: string;
};
