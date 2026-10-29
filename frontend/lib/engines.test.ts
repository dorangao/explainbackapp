import { describe, expect, it } from "vitest";
import { demoSchema } from "../../public/demo-model.mjs";
import {
  lessonSchema,
  generatedLessonSchema,
} from "../../public/lesson-schema.mjs";
import { galleryLessons, validateLesson, createLessonPlayer } from "./shared";
import type { ModelDemo, ProcessDemo, Lesson } from "./types";

// Compile-time key lists for the hand-written types. If a key is added to the type
// but not here, the `satisfies` check fails; if the JSON schema gains or loses a key,
// the runtime comparison below fails. Either way the two drift together, not apart.
const modelKeys = [
  "kind",
  "title",
  "claim",
  "assumptions",
  "inputs",
  "axis",
  "outputs",
  "transfer",
] as const satisfies readonly (keyof ModelDemo)[];
const processKeys = [
  "kind",
  "title",
  "claim",
  "assumptions",
  "stages",
  "transfer",
] as const satisfies readonly (keyof ProcessDemo)[];
const lessonKeys = [
  "version",
  "title",
  "intro",
  "chapters",
] as const satisfies readonly (keyof Lesson)[];

describe("engine declarations stay in step with the JSON schema", () => {
  it("model and process demo schemas require exactly the typed keys", () => {
    const [model, process] = demoSchema.anyOf;
    expect([...model.required].sort()).toEqual([...modelKeys].sort());
    expect([...process.required].sort()).toEqual([...processKeys].sort());
    expect(Object.keys(model.properties).sort()).toEqual([...modelKeys].sort());
    expect(Object.keys(process.properties).sort()).toEqual(
      [...processKeys].sort(),
    );
  });
  it("lesson schemas require exactly the typed top-level keys", () => {
    for (const schema of [lessonSchema, generatedLessonSchema] as {
      required: string[];
    }[])
      expect([...schema.required].sort()).toEqual([...lessonKeys].sort());
  });
  it("typed engine calls round-trip a gallery lesson without casts", () => {
    const lesson = validateLesson(structuredClone(galleryLessons[0].lesson));
    const player = createLessonPlayer(lesson);
    expect(player.state.stage).toBe("predict");
    player.predict("agree");
    expect(player.next()).toBe(true);
    expect(player.experiment("zh").title).toBe(
      galleryLessons[0].lesson.chapters[0].demo?.title.zh,
    );
  });
});
