// Typed surface of the generated show table next to this file. Hand-maintained.
import type { GalleryShow } from "../frontend/lib/types";
export const galleryShows: Readonly<Record<string, GalleryShow>>;
export function galleryShow(id: string): GalleryShow | null;
export function showIdFromHash(hash: string | undefined): string | null;
