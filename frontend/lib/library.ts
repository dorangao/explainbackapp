// A creator's saved lessons and the public shared ones. Saving, listing and opening make
// no model request; only the sign-in session is sent, as with every /api call.
import type {
  Bilingual,
  Feedback,
  Language,
  Lesson,
  Post,
  Show,
  Target,
  TryoutChapter,
  TryoutReply,
  Verdict,
} from "./types";
import type { Cached } from "./studio-cache";
import { fingerprint } from "./studio-cache";
import type { LessonCurrency } from "./types";
import { getJson } from "./api";
export type LessonKind = "model" | "process" | "catalog";
export type SavedSummary = {
  id: string;
  title: Bilingual;
  intro: Bilingual;
  kind: LessonKind;
  hasShow: boolean;
  // The test learner's report and the number of chapters with an explain-back grade.
  hasTryout: boolean;
  graded: number;
  model: string | null;
  // Image URLs kept in Blob storage; null when none was saved.
  cover: string | null;
  sketch: string | null;
  shared: boolean;
  // The author's stable-or-dated mark, when the lesson carries one.
  currency?: LessonCurrency | null;
  createdAt: number;
  updatedAt: number;
};
// The test learner's report as saved: checked answers included, session fields dropped.
export type SavedTryout = {
  chapters: TryoutChapter[];
  overall: string;
  rating: number;
  model: string | null;
  language: Language;
};
// One chapter's explain-back: the learner's words, Spark's verdict and feedback, and
// the client cache key so the restored grade is fresh or stale exactly as before.
export type SavedGrade = {
  explanation: string;
  feedback: string;
  verdict: Verdict;
  followUp: string | null;
  model: string | null;
  language: Language;
  key: string;
};
export type SavedLesson = SavedSummary & {
  lesson: Lesson;
  show: Show | null;
  coverModel: string | null;
  illustrations: Record<string, string>;
  tryout: SavedTryout | null;
  grades: Record<string, SavedGrade>;
};
// A saved tryout report and grades in the shapes the Studio caches use. Keys are the ones
// the caches were made with, so each result shows as fresh or stale against the live
// lesson state exactly as before; nothing here makes a request.
export function cachesFromSaved(
  lesson: Lesson,
  record: { tryout: SavedTryout | null; grades: Record<string, SavedGrade> },
  at: number,
  target: Target | null,
): {
  tryout: Cached<TryoutReply> | null;
  guides: Record<string, Cached<Feedback>>;
  texts: Record<string, string>;
} {
  const tryout =
    record.tryout && target
      ? {
          reply: {
            ...record.tryout,
            model: record.tryout.model ?? undefined,
            llm: target,
            attemptsRemaining: 0,
          } as TryoutReply,
          at,
          key: fingerprint({ lesson, language: record.tryout.language }),
        }
      : null;
  const guides: Record<string, Cached<Feedback>> = {};
  const texts: Record<string, string> = {};
  for (const [k, g] of Object.entries(record.grades ?? {})) {
    texts[k] = g.explanation;
    guides[k] = {
      reply: {
        explanation: g.feedback,
        nextAction: "replay",
        attemptsRemaining: 0,
        verdict: g.verdict,
        followUp: g.followUp ?? undefined,
        model: g.model ?? undefined,
      },
      at,
      key: g.key,
    };
  }
  return { tryout, guides, texts };
}
export const sharedIdFromHash = (hash: string): string | null =>
  /^#shared:([a-f0-9]{16})$/.exec(hash ?? "")?.[1] ?? null;
export const sharedUrl = (id: string) =>
  `${location.origin}${location.pathname}#shared:${id}`;
export const listMine = () =>
  getJson<{ lessons: SavedSummary[]; limit: number }>("/api/lessons");
export const readMine = (id: string) =>
  getJson<SavedLesson>(`/api/lessons/${id}`);
export const listShared = () =>
  getJson<{ lessons: SavedSummary[] }>("/api/shared");
// A creator-drawn library cover for a reviewed lesson, as the app serves it.
export type CoverRecord = {
  src: string;
  model: string;
  createdAt: string;
  promptVersion: string;
};
export const listCovers = () =>
  getJson<{ covers: Record<string, CoverRecord> }>("/api/covers");
export const readShared = (id: string) =>
  getJson<SavedLesson>(`/api/shared/${id}`);
export const saveLesson = (
  post: Post,
  body: {
    id?: string;
    lesson: Lesson;
    show?: Show | null;
    model?: string | null;
    cover?: string | null;
    coverModel?: string | null;
    illustrations?: Record<string, string> | null;
    sketch?: string | null;
    tryout?: SavedTryout | null;
    grades?: Record<string, SavedGrade> | null;
  },
) => post<SavedSummary>("/api/lessons", body);
export const shareLesson = (post: Post, id: string, shared: boolean) =>
  post<SavedSummary>("/api/lessons/share", { id, shared });
export const deleteLesson = (post: Post, id: string) =>
  post<{ deleted: true; id: string }>("/api/lessons/delete", { id });
// Copies a share link; falls back to the system share sheet where the clipboard is blocked.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
export const canSystemShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";
export async function systemShare(data: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}
