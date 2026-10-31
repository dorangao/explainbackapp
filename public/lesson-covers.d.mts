// Typed surface of the generated cover manifest next to this file. Hand-maintained.
export type LessonCover = {
  src: string;
  model: string;
  createdAt: string;
  promptVersion: string;
};
export const lessonCovers: Readonly<Record<string, LessonCover>>;
export function lessonCover(id: string): LessonCover | null;
