// Cached model results and the inputs they answered. A result is shown again without a
// provider request while its inputs are unchanged; a changed input marks it stale and the
// next request is an explicit "send changes" click. Nothing here talks to the server.
import type { Language, Player } from "./types";

export type Cached<T> = { reply: T; at: number; key: string };
export type Pace = "off" | "slow" | "normal" | "fast";
export const paces: Pace[] = ["off", "slow", "normal", "fast"];
// Multiplier on every guided-replay duration (dwell and experiment playback).
export const paceFactor = (pace: Pace) =>
  pace === "slow" ? 1.6 : pace === "fast" ? 0.5 : 1;

// Stable JSON: object keys sorted so equal inputs always fingerprint the same.
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
// FNV-1a over the stable JSON; short enough to store, specific enough for equality.
export function fingerprint(value: unknown): string {
  const text = stable(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}-${text.length}`;
}
export const isStale = <T>(cached: Cached<T> | null, key: string) =>
  cached !== null && cached.key !== key;
// What the explain-back grading depends on: the lesson, the learner's position and words.
export function guideKey(
  player: Player,
  language: Language,
  explanation: string | undefined,
) {
  const s = player.state;
  return fingerprint({
    lesson: player.lesson,
    chapter: s.chapter,
    variant: s.variant,
    prediction: s.prediction,
    controls: s.controls,
    metric: s.metric,
    language,
    explanation: explanation?.trim() || undefined,
  });
}
export const formatCachedAt = (at: number, language: Language) =>
  new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
