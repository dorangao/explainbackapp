import { describe, expect, it } from "vitest";
import { lessonChanges } from "./lesson-diff";
import type { Lesson } from "./types";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";

const cooling = () => coolingLesson() as unknown as Lesson,
  process = () => processLesson() as unknown as Lesson;

describe("lessonChanges", () => {
  it("reports nothing for identical lessons in either language", () => {
    expect(lessonChanges(cooling(), cooling(), "en")).toEqual([]);
    expect(lessonChanges(process(), process(), "zh")).toEqual([]);
  });
  it("lists text, numeric and formula changes field by field in the chosen language", () => {
    const before = cooling(),
      after = cooling();
    after.title.en = "Why coffee cooling slows down";
    const demo = after.chapters[0].demo!;
    if (demo.kind !== "model") throw new Error("fixture");
    demo.inputs[0].max = 95;
    demo.outputs[0].expression =
      "ambient + (initial - ambient) * exp(-2 * rate * x)";
    demo.transfer.question.zh = "十分钟后的温度是多少？以 °C 作答。";
    const en = lessonChanges(before, after, "en");
    expect(en.map((c) => c.path)).toEqual([
      "title",
      "chapters[0].demo.inputs.initial.max",
      "chapters[0].demo.outputs.temp.expression",
    ]);
    expect(en[0]).toMatchObject({ kind: "text", before: "Cooling coffee" });
    expect(en[1]).toMatchObject({ kind: "number", before: "100", after: "95" });
    const zh = lessonChanges(before, after, "zh");
    expect(zh.map((c) => c.path)).toContain(
      "chapters[0].demo.transfer.question",
    );
    expect(zh.map((c) => c.path)).not.toContain("title");
  });
  it("marks added and removed inputs, outputs, stages and chapters", () => {
    const before = cooling(),
      after = cooling();
    const demo = after.chapters[0].demo!;
    if (demo.kind !== "model") throw new Error("fixture");
    demo.outputs.push({
      id: "speed",
      label: { en: "Cooling speed", zh: "降温速度" },
      unit: "°C/min",
      expression: "rate * (temp - ambient)",
    });
    demo.inputs.splice(1, 1);
    after.chapters.push(structuredClone(before.chapters[0]));
    const changes = lessonChanges(before, after, "en");
    expect(
      changes.find((c) => c.path === "chapters[0].demo.outputs.speed"),
    ).toMatchObject({ kind: "added" });
    expect(
      changes.find((c) => c.path === "chapters[0].demo.inputs.ambient"),
    ).toMatchObject({ kind: "removed" });
    expect(changes.find((c) => c.path === "chapters[1]")).toMatchObject({
      kind: "added",
      after: "generated",
    });
    const p1 = process(),
      p2 = process();
    const stages = p2.chapters[0].demo!;
    if (stages.kind !== "process") throw new Error("fixture");
    stages.stages.push({
      title: { en: "Cache", zh: "缓存" },
      detail: { en: "Store it.", zh: "存起来。" },
    });
    stages.transfer.answer = 1;
    const pc = lessonChanges(p1, p2, "en");
    expect(pc.map((c) => c.path)).toEqual([
      "chapters[0].demo.stages[3].title",
      "chapters[0].demo.stages[3].detail",
      "chapters[0].demo.transfer.answer",
    ]);
    expect(pc[2]).toMatchObject({ before: "1", after: "2" });
  });
  it("reports a renderer change as one item instead of diffing incompatible fields", () => {
    const changes = lessonChanges(cooling(), process(), "en");
    expect(changes.map((c) => c.path)).toContain("chapters[0].demo.kind");
    expect(changes.some((c) => c.path.includes("inputs"))).toBe(false);
  });
});
