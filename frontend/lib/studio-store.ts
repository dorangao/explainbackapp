// The last lesson, remembered per browser in localStorage. Holds the draft, review state,
// cached model results and the replay pace. No invite codes, session ids or credentials
// are stored; the draft and replies carry none today and this file must keep it so.
import type {
  Feedback,
  Lesson,
  Player,
  PlayerState,
  ShowReply,
  TryoutReply,
} from "./types";
import type { Cached, Pace } from "./studio-cache";
import { paces } from "./studio-cache";
import { createLessonPlayer, validateLesson } from "./shared";

export const storageKey = "explainback-studio-draft";
export type StoredStudio = {
  version: 1;
  savedAt: number;
  draft: Lesson;
  topic: string;
  creation: string;
  reviewed: boolean;
  revisionPrompt: string;
  compose: { at: number; key: string } | null;
  revise: { at: number; key: string } | null;
  tryout: Cached<TryoutReply> | null;
  show: Cached<ShowReply> | null;
  guide: Record<string, Cached<Feedback>>;
  explanations: Record<string, string>;
  player: PlayerState | null;
  presenting: boolean;
  pace: Pace;
};
// Blocklist of field names that must never reach storage, whatever a reply contains.
const secretField = /session|code|token|secret|password|key$|authorization/i;
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      if (!secretField.test(k) || k === "key") out[k] = scrub(v);
    return out;
  }
  return value;
}
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
export function saveStudio(value: Omit<StoredStudio, "version" | "savedAt">) {
  const store = storage();
  if (!store) return;
  const record = scrub({ ...value, version: 1, savedAt: Date.now() });
  try {
    store.setItem(storageKey, JSON.stringify(record));
  } catch {
    // Quota: keep the lesson and drop the show (its cover is the large part).
    try {
      store.setItem(
        storageKey,
        JSON.stringify({ ...(record as object), show: null }),
      );
    } catch {}
  }
}
export function clearStudio() {
  try {
    storage()?.removeItem(storageKey);
  } catch {}
}
export function loadStudio(): StoredStudio | null {
  try {
    const raw = storage()?.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredStudio>;
    if (value.version !== 1 || !value.draft) return null;
    const draft = validateLesson(value.draft);
    const cached = <T>(c: unknown): Cached<T> | null =>
      c &&
      typeof c === "object" &&
      typeof (c as Cached<T>).at === "number" &&
      typeof (c as Cached<T>).key === "string" &&
      (c as Cached<T>).reply !== undefined
        ? (c as Cached<T>)
        : null;
    const guide: Record<string, Cached<Feedback>> = {};
    for (const [k, v] of Object.entries(value.guide ?? {})) {
      const c = cached<Feedback>(v);
      if (c) guide[k] = c;
    }
    return {
      version: 1,
      savedAt: typeof value.savedAt === "number" ? value.savedAt : Date.now(),
      draft,
      topic: typeof value.topic === "string" ? value.topic : "",
      creation: value.creation === "catalog" ? "catalog" : "generated",
      reviewed: value.reviewed === true,
      revisionPrompt:
        typeof value.revisionPrompt === "string" ? value.revisionPrompt : "",
      compose: cached<null>(value.compose && { ...value.compose, reply: null })
        ? { at: value.compose!.at, key: value.compose!.key }
        : null,
      revise: cached<null>(value.revise && { ...value.revise, reply: null })
        ? { at: value.revise!.at, key: value.revise!.key }
        : null,
      tryout: cached<TryoutReply>(value.tryout),
      show: cached<ShowReply>(value.show),
      guide,
      explanations: Object.fromEntries(
        Object.entries(value.explanations ?? {}).filter(
          ([, v]) => typeof v === "string",
        ),
      ) as Record<string, string>,
      player:
        value.player && typeof value.player === "object" ? value.player : null,
      presenting: value.presenting === true,
      pace: paces.includes(value.pace as Pace) ? (value.pace as Pace) : "off",
    };
  } catch {
    return null;
  }
}
export const hasStoredStudio = () => loadStudio() !== null;
// Rebuilds a player at a saved position by replaying the engine's own transitions, so
// the restored state is one the engine could have reached itself.
export function restorePlayer(
  lesson: Lesson,
  saved: PlayerState | null,
): Player {
  const player = createLessonPlayer(lesson);
  if (!saved) return player;
  try {
    const chapters = lesson.chapters.length;
    const target = Math.max(0, Math.min(chapters - 1, saved.chapter | 0));
    const solve = () =>
      player.check(String(player.experiment().transfer.answer));
    for (let i = 0; i < target; i++) {
      player.predict("unsure");
      player.next();
      player.scrub(1);
      player.next();
      player.next();
      solve();
      player.next();
    }
    if (saved.variant === 1) player.variant(1);
    for (const [id, value] of Object.entries(saved.controls ?? {}))
      if (Number.isFinite(value)) player.input(id, value);
    if (Number.isFinite(saved.metric) && saved.metric > 0)
      player.output(saved.metric);
    const order = ["predict", "experiment", "explain", "transfer", "complete"];
    const stage = Math.max(0, order.indexOf(saved.stage));
    if (saved.prediction) player.predict(saved.prediction);
    if (stage >= 1 && player.next()) {
      player.scrub(stage >= 2 ? 1 : Number(saved.progress) || 0);
      if (stage >= 2) player.next();
      if (stage >= 3) player.next();
      if (stage >= 3 && saved.transfer === true) solve();
      if (stage >= 4) player.next();
    }
  } catch {
    return createLessonPlayer(lesson);
  }
  return player;
}
