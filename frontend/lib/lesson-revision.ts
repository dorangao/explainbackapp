import type { Chapter, Lesson } from "./types";
import { stableJson } from "./studio-cache";

const demoKey = (chapter: Chapter) =>
  chapter.experiment === "generated" && chapter.demo?.kind === "model"
    ? stableJson(chapter.demo)
    : null;

// Only the creator's prior confirmation can travel with an unchanged, unique demo.
// Compare the complete canonical definition, not a short hash or array position.
export function preserveRevisionCanvas(
  before: Lesson,
  after: Lesson,
): {
  lesson: Lesson;
  removedConnections: number;
} {
  const previousKeys = before.chapters.map(demoKey),
    nextKeys = after.chapters.map(demoKey);
  let retained = 0;
  const chapters = after.chapters.map(
    ({ canvas: _canvas, ...chapter }, index) => {
      const key = nextKeys[index];
      if (
        key === null ||
        previousKeys.filter((k) => k === key).length !== 1 ||
        nextKeys.filter((k) => k === key).length !== 1
      )
        return chapter;
      const previous = before.chapters[previousKeys.indexOf(key)];
      if (!previous.canvas) return chapter;
      retained++;
      return { ...chapter, canvas: structuredClone(previous.canvas) };
    },
  );
  return {
    lesson: { ...after, chapters },
    removedConnections:
      before.chapters.filter((c) => c.canvas).length - retained,
  };
}
