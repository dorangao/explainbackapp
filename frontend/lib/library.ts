// A creator's saved lessons and the public shared ones. Saving, listing and opening make
// no model request; only the sign-in session is sent, as with every /api call.
import type { Bilingual, Lesson, Post, Show } from "./types";
import { getJson } from "./api";
export type LessonKind = "model" | "process" | "catalog";
export type SavedSummary = {
  id: string;
  title: Bilingual;
  intro: Bilingual;
  kind: LessonKind;
  hasShow: boolean;
  model: string | null;
  // Image URLs kept in Blob storage; null when none was saved.
  cover: string | null;
  sketch: string | null;
  shared: boolean;
  createdAt: number;
  updatedAt: number;
};
export type SavedLesson = SavedSummary & {
  lesson: Lesson;
  show: Show | null;
  coverModel: string | null;
  illustrations: Record<string, string>;
};
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
