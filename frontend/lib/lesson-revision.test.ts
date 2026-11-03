import { describe, expect, it } from "vitest";
import { preserveRevisionCanvas } from "./lesson-revision";
import type { Chapter, Lesson } from "./types";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";

function connected(): Lesson {
  const lesson = coolingLesson() as Lesson;
  lesson.chapters[0].canvas = {
    concept: "cup",
    input: "rate",
    box: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
  };
  return lesson;
}
function withoutCanvas(chapter: Chapter): Chapter {
  const { canvas: _canvas, ...rest } = structuredClone(chapter);
  return rest;
}
function model(lesson: Lesson) {
  const demo = lesson.chapters[0].demo;
  if (demo?.kind !== "model") throw new Error("fixture");
  return demo;
}

describe("preserveRevisionCanvas", () => {
  it("keeps a creator binding across text edits and object-key reordering without mutating either lesson", () => {
    const before = connected(),
      after = coolingLesson() as Lesson;
    after.title.en = "A revised title";
    after.chapters[0].explanation.en = "A clearer explanation.";
    const { kind, ...fields } = model(after);
    after.chapters[0].demo = { ...fields, kind };
    const result = preserveRevisionCanvas(before, after);
    expect(result.removedConnections).toBe(0);
    expect(result.lesson.chapters[0].canvas).toEqual({
      concept: "cup",
      input: "rate",
      box: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
    });
    expect(result.lesson.title.en).toBe("A revised title");
    expect(after.chapters[0].canvas).toBeUndefined();
    result.lesson.chapters[0].canvas!.concept = "changed result";
    expect(before.chapters[0].canvas!.concept).toBe("cup");
  });
  it("follows unique demos when their chapters are reordered", () => {
    const before = connected(),
      other = connected();
    model(other).outputs[0].expression =
      "ambient+(initial-ambient)*exp(-2*rate*x)";
    other.chapters[0].canvas!.concept = "other cup";
    other.chapters[0].canvas!.input = "initial";
    before.chapters.push(other.chapters[0]);
    const after = {
      ...before,
      chapters: [
        withoutCanvas(before.chapters[1]),
        withoutCanvas(before.chapters[0]),
      ],
    };
    const result = preserveRevisionCanvas(before, after);
    expect(result.lesson.chapters.map((c) => c.canvas?.concept)).toEqual([
      "other cup",
      "cup",
    ]);
    expect(result.lesson.chapters.map((c) => c.canvas?.input)).toEqual([
      "initial",
      "rate",
    ]);
    expect(result.removedConnections).toBe(0);
  });
  it.each(["before", "after"] as const)(
    "does not guess between duplicate demos in the %s lesson",
    (side) => {
      const before = connected(),
        after = coolingLesson() as Lesson;
      if (side === "before")
        before.chapters.push(structuredClone(before.chapters[0]));
      else after.chapters.push(structuredClone(after.chapters[0]));
      const result = preserveRevisionCanvas(before, after);
      expect(result.lesson.chapters.every((c) => c.canvas === undefined)).toBe(
        true,
      );
      expect(result.removedConnections).toBe(side === "before" ? 2 : 1);
    },
  );
  it.each(["range", "renamed control", "formula", "process"] as const)(
    "requires new confirmation after a %s change",
    (change) => {
      const before = connected(),
        after = coolingLesson() as Lesson;
      if (change === "range") model(after).inputs[2].max = 0.3;
      if (change === "renamed control")
        after.chapters[0].demo = JSON.parse(
          JSON.stringify(model(after)).replaceAll("rate", "coefficient"),
        );
      if (change === "formula")
        model(after).outputs[0].expression =
          "ambient+(initial-ambient)*exp(-2*rate*x)";
      if (change === "process")
        after.chapters[0] = (processLesson() as Lesson).chapters[0];
      const result = preserveRevisionCanvas(before, after);
      expect(result.lesson.chapters[0].canvas).toBeUndefined();
      expect(result.removedConnections).toBe(1);
    },
  );
  it.each([true, false])(
    "does not accept model-created confirmation (prior binding: %s)",
    (hasPrior) => {
      const before = hasPrior ? connected() : (coolingLesson() as Lesson);
      const after = connected();
      after.chapters[0].canvas!.concept = "model invented object";
      after.chapters[0].canvas!.input = "ambient";
      const result = preserveRevisionCanvas(before, after);
      expect(result.lesson.chapters[0].canvas?.concept).toBe(
        hasPrior ? "cup" : undefined,
      );
      expect(result.removedConnections).toBe(0);
      expect(after.chapters[0].canvas!.concept).toBe("model invented object");
    },
  );
  it("does not assign a removed chapter's region to a new demo", () => {
    const before = connected(),
      after = coolingLesson() as Lesson;
    model(after).title.en = "An unrelated new demo";
    const result = preserveRevisionCanvas(before, after);
    expect(result.lesson.chapters[0].canvas).toBeUndefined();
    expect(result.removedConnections).toBe(1);
  });
});
