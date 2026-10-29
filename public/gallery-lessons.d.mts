// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
import type { GalleryItem, Language } from "../frontend/lib/types";
export const galleryLessons: readonly GalleryItem[];
export const galleryIds: readonly string[];
export function galleryLesson(id: string): GalleryItem | null;
export function galleryIdFromHash(hash: string | undefined): string | null;
export function gallerySourceNote(source: string, language?: Language): string;
