import { beforeEach, describe, expect, it } from "vitest";
import {
  convertible,
  displayUnit,
  fromDisplay,
  hasConvertibleUnits,
  presentExperiment,
  rememberUnitSystem,
  rememberedUnitSystem,
  toDisplay,
  withoutUnits,
} from "./units";
import type { Experiment } from "./types";

// A cooling-model experiment as generated-demo.mjs builds it, in the lesson's own units.
function cooling(): Experiment {
  const at = (x: number) => 20 + (80 - 20) * Math.exp(-0.1 * x);
  const transferAt = (x: number) => 15 + (90 - 15) * Math.exp(-0.05 * x);
  return {
    id: "generated",
    generated: true,
    kind: "model",
    title: "Newton cooling explorer",
    claim: "Cooling slows near room temperature.",
    assumptions: "Ideal cooling.",
    steps: 100,
    variants: [],
    metrics: [{ label: "Temperature", value: at(30), unit: "°C" }],
    series: ["Temperature"],
    unit: "°C",
    axis: "Time (min)",
    axisLabel: "Time",
    axisUnit: "min",
    axisEnds: [0, 30],
    xAt: (u) => 30 * u,
    outputLabel: "Temperature",
    resultPrefix: "Calculated: ",
    inputs: [
      {
        id: "initial",
        label: "Initial temperature",
        unit: "°C",
        min: 60,
        max: 100,
        step: 1,
        value: 80,
      },
      {
        id: "ambient",
        label: "Room temperature",
        unit: "°C",
        min: 10,
        max: 30,
        step: 1,
        value: 20,
      },
      {
        id: "rate",
        label: "Cooling coefficient",
        unit: "1/min",
        min: 0.01,
        max: 0.2,
        step: 0.01,
        value: 0.1,
      },
    ],
    formulas: [
      {
        id: "temp",
        label: "Temperature",
        unit: "°C",
        expression: "ambient+(initial-ambient)*exp(-rate*x)",
      },
    ],
    sample: (u) => [at(30 * u)],
    caption: (u) => `Time = ${30 * u} min · Temperature = ${at(30 * u)} °C`,
    result: `Calculated: Temperature = ${at(30)} °C`,
    transferQuestion: "What is the temperature at the marked time?",
    transferInputs: [
      { label: "Initial temperature", value: 90, unit: "°C" },
      { label: "Room temperature", value: 15, unit: "°C" },
      { label: "Cooling coefficient", value: 0.05, unit: "1/min" },
    ],
    transferAt: 10,
    transferOutputLabel: "Temperature",
    transfer: {
      type: "number",
      question:
        "What is the temperature at the marked time?\nInitial temperature = 90 °C · Room temperature = 15 °C · Cooling coefficient = 0.05 1/min\nTime = 10 min → Temperature",
      answer: transferAt(10),
      unit: "°C",
      tolerance: 0.005 * transferAt(10),
    },
  };
}

describe("unit rules", () => {
  it("converts the common families linearly and leaves everything else alone", () => {
    expect(toDisplay(100, "°C", "us")).toBe(212);
    expect(fromDisplay(212, "°C", "us")).toBe(100);
    expect(toDisplay(1, "m", "us")).toBeCloseTo(3.2808, 4);
    expect(toDisplay(1, "kg", "us")).toBeCloseTo(2.2046, 4);
    expect(displayUnit("°C", "us")).toBe("°F");
    expect(displayUnit("°C", "metric")).toBe("°C");
    expect(displayUnit("1/min", "us")).toBe("1/min");
    expect(toDisplay(0.1, "1/min", "us")).toBe(0.1);
    expect(convertible("℃")).toBe(true);
    expect(convertible("s")).toBe(false);
  });
});

describe("presenting an experiment", () => {
  it("is the experiment itself in the lesson's own system", () => {
    const e = cooling();
    const shown = presentExperiment(e, "metric");
    expect(shown.experiment).toBe(e);
    expect(shown.convertible).toBe(true);
    expect(shown.toBaseInput("initial", 85)).toBe(85);
  });
  it("converts labels, ranges, readouts, the plot, the caption and the transfer for US viewers", () => {
    const e = cooling();
    const {
      experiment: us,
      toBaseInput,
      toBaseAnswer,
    } = presentExperiment(e, "us");
    const initial = us.inputs!.find((p) => p.id === "initial")!;
    expect([
      initial.unit,
      initial.min,
      initial.max,
      initial.value,
      initial.step,
    ]).toEqual(["°F", 140, 212, 176, 1.8]);
    expect(us.inputs!.find((p) => p.id === "rate")!.unit).toBe("1/min");
    expect(us.unit).toBe("°F");
    expect(us.axis).toBe("Time (min)");
    expect(us.sample(0)[0]).toBe(176);
    expect(us.metrics[0].unit).toBe("°F");
    expect(us.metrics[0].value).toBeCloseTo(e.metrics[0].value * 1.8 + 32, 6);
    expect(us.caption(0)).toBe("Time = 0 min · Temperature = 176 °F");
    expect(us.result).toMatch(/^Calculated: Temperature = .* °F$/);
    expect(us.formulas![0].unit).toBe("°F");
    expect(us.transfer.unit).toBe("°F");
    expect(us.transfer.question).toContain(
      "Initial temperature = 194 °F · Room temperature = 59 °F · Cooling coefficient = 0.05 1/min",
    );
    expect(us.transfer.question).toContain("Time = 10 min → Temperature");
    expect(us.transfer.answer).toBeCloseTo(e.transfer.answer * 1.8 + 32, 6);
    // Typed values come back in °C, snapped to the authored step and clamped to the range.
    expect(toBaseInput("initial", 176)).toBe(80);
    expect(toBaseInput("initial", 177)).toBe(81);
    expect(toBaseInput("initial", 300)).toBe(100);
    expect(toBaseInput("rate", 0.07)).toBe(0.07);
    expect(toBaseAnswer(toDisplay(e.transfer.answer, "°C", "us"))).toBeCloseTo(
      e.transfer.answer,
      6,
    );
  });
  it("leaves catalog experiments and process lessons untouched", () => {
    const e = { ...cooling(), generated: false };
    expect(hasConvertibleUnits(e)).toBe(false);
    expect(presentExperiment(e, "us").experiment).toBe(e);
    const process = { ...cooling(), kind: "process" as const };
    expect(presentExperiment(process, "us").experiment).toBe(process);
  });
});

describe("viewer memory and cache keys", () => {
  beforeEach(() => localStorage.clear());
  it("remembers the viewer's choice in this browser only", () => {
    expect(rememberedUnitSystem()).toBeNull();
    rememberUnitSystem("us");
    expect(rememberedUnitSystem()).toBe("us");
    localStorage.setItem("explainback.units", "imperial");
    expect(rememberedUnitSystem()).toBeNull();
  });
  it("strips the default-units field so it never changes a cache key or reaches the model", () => {
    const lesson = {
      version: 2 as const,
      title: { en: "t", zh: "t" },
      intro: { en: "i", zh: "i" },
      chapters: [],
      units: "us" as const,
    };
    expect("units" in withoutUnits(lesson)).toBe(false);
    expect(withoutUnits(lesson).title).toBe(lesson.title);
  });
});

describe("dimensionless quantities", () => {
  it('never prints the authored "1" after a value when the texts are rebuilt in another system', () => {
    const e = cooling();
    e.transferInputs = [
      ...e.transferInputs!,
      { label: "Samples", value: 4, unit: "1" },
    ];
    e.metrics = [...e.metrics, { label: "Samples", value: 4, unit: "1" }];
    const { experiment } = presentExperiment(e, "us");
    expect(experiment.transfer.question).toContain(
      "Cooling coefficient = 0.05 1/min · Samples = 4\n",
    );
    expect(experiment.result).toContain("Samples = 4");
    expect(experiment.result).not.toMatch(/Samples = 4 1/);
    // A dimensionless axis keeps its bare label.
    const bare = { ...cooling(), axisUnit: "1", axis: "Count" };
    expect(presentExperiment(bare, "us").experiment.axis).toBe("Time");
  });
});
