import { expect, it } from "vitest";
import { answerPrecision } from "./answer-precision";
import { presentExperiment, type UnitSystem } from "./units";
import { chapterExperiment } from "./shared";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";
import type { Lesson, ModelDemo } from "./types";

function experiment(answer: number, unit = "m") {
  const lesson = coolingLesson() as Lesson;
  const demo = lesson.chapters[0].demo as ModelDemo;
  demo.outputs[0].expression = String(answer);
  demo.outputs[0].unit = unit;
  return chapterExperiment(lesson.chapters[0], 0, "en");
}

it.each([
  {
    answer: 63.57080299231656,
    unit: "°C",
    system: "metric",
    step: "0.1",
    rounded: 63.6,
  },
  {
    answer: 63.57080299231656,
    unit: "°C",
    system: "us",
    step: "0.1",
    rounded: 146.4,
  },
  { answer: 1, unit: "°C", system: "us", step: "0.001", rounded: 33.8 },
  { answer: -17.7777, unit: "°C", system: "us", step: "0.1", rounded: 0 },
  {
    answer: 1.234567e-12,
    unit: "m",
    system: "metric",
    step: "1e-15",
    rounded: 1.235e-12,
  },
  {
    answer: 1.234567e-12,
    unit: "m",
    system: "us",
    step: "1e-14",
    rounded: 4.05e-12,
  },
  {
    answer: -123.456,
    unit: "m",
    system: "metric",
    step: "0.1",
    rounded: -123.5,
  },
  {
    answer: 123456789,
    unit: "m",
    system: "metric",
    step: "100000",
    rounded: 123500000,
  },
  {
    answer: 0.125,
    unit: "1",
    system: "metric",
    step: "0.0001",
    rounded: 0.125,
  },
])(
  "supplies a safe displayed increment for $answer $unit in $system",
  ({ answer, unit, system, step, rounded }) => {
    const base = experiment(answer, unit);
    const presented = presentExperiment(base, system as UnitSystem);
    expect(answerPrecision(base, presented)).toEqual({ kind: "round", step });
    // A hand-rounded answer at the advertised precision must pass the unchanged authored check.
    expect(
      Math.abs(presented.toBaseAnswer(rounded) - answer),
    ).toBeLessThanOrEqual(base.transfer.tolerance);
  },
);

it.each([0.01, 0.1, 1, 1e-7])(
  "handles an exact power-of-ten tolerance of %s",
  (tolerance) => {
    const base = experiment(18);
    base.transfer.tolerance = tolerance;
    expect(answerPrecision(base, presentExperiment(base, "metric"))).toEqual({
      kind: "round",
      step: String(tolerance),
    });
  },
);

it.each([0, 1e-321])(
  "uses the full value when no positive rounding increment is representable for %s",
  (answer) => {
    const base = experiment(answer);
    expect(answerPrecision(base, presentExperiment(base, "metric"))).toEqual({
      kind: "full",
    });
  },
);

it("directs a precision-losing temperature conversion back to authored units", () => {
  const base = experiment(1e-12, "°C");
  expect(answerPrecision(base, presentExperiment(base, "us"))).toEqual({
    kind: "authored",
  });
  expect(answerPrecision(base, presentExperiment(base, "metric"))).toEqual({
    kind: "round",
    step: "1e-15",
  });
  // An exactly representable zero does not need the conversion recovery.
  const zero = experiment(0, "°C");
  expect(answerPrecision(zero, presentExperiment(zero, "us"))).toEqual({
    kind: "full",
  });
});

it("does not give numeric precision guidance for choices", () => {
  const base = chapterExperiment(
    (processLesson() as Lesson).chapters[0],
    0,
    "en",
  );
  expect(answerPrecision(base, presentExperiment(base, "metric"))).toBeNull();
});
