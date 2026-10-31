// Display units for generated model lessons. A lesson is authored and computed in its own
// units, and the model never sees a converted number. A viewer may ask for US customary units;
// the conversion then happens at the edge, on labels, readouts, the plotted values, and the
// transfer answer the learner types, which is converted back before the code checks it.
import type { Experiment } from "./types";
import { formatDemoNumber as fmt } from "./shared";

export type UnitSystem = "metric" | "us";
export const UNIT_SYSTEMS: readonly UnitSystem[] = ["metric", "us"];
export const isUnitSystem = (value: unknown): value is UnitSystem =>
  value === "metric" || value === "us";

type Rule = { us: string; factor: number; offset?: number };
// Authored unit → its US customary counterpart: display = base × factor + offset.
// Only linear conversions; anything not listed is shown as authored.
const RULES: Record<string, Rule> = {
  "°C": { us: "°F", factor: 9 / 5, offset: 32 },
  "°C/min": { us: "°F/min", factor: 9 / 5 },
  "°C/s": { us: "°F/s", factor: 9 / 5 },
  "°C/h": { us: "°F/h", factor: 9 / 5 },
  m: { us: "ft", factor: 3.280839895 },
  cm: { us: "in", factor: 0.3937007874 },
  mm: { us: "in", factor: 0.03937007874 },
  km: { us: "mi", factor: 0.6213711922 },
  "m/s": { us: "ft/s", factor: 3.280839895 },
  "km/h": { us: "mph", factor: 0.6213711922 },
  "m/s²": { us: "ft/s²", factor: 3.280839895 },
  "m/s^2": { us: "ft/s²", factor: 3.280839895 },
  kg: { us: "lb", factor: 2.2046226218 },
  g: { us: "oz", factor: 0.03527396195 },
  L: { us: "gal", factor: 0.2641720524 },
  mL: { us: "fl oz", factor: 0.0338140227 },
  N: { us: "lbf", factor: 0.2248089431 },
  kPa: { us: "psi", factor: 0.1450377377 },
};
const normalize = (unit: string) =>
  unit.trim().replace(/\s+/g, "").replace("℃", "°C");
export const unitRule = (unit: string): Rule | null =>
  RULES[normalize(unit)] ?? null;
export const convertible = (unit: string) => unitRule(unit) !== null;
// Floating-point noise from a conversion must not leak into labels or grid checks.
const tidy = (n: number) => Number(n.toPrecision(10));

export function displayUnit(unit: string, system: UnitSystem): string {
  return system === "us" ? (unitRule(unit)?.us ?? unit) : unit;
}
export function toDisplay(
  value: number,
  unit: string,
  system: UnitSystem,
): number {
  const rule = system === "us" ? unitRule(unit) : null;
  return rule ? tidy(value * rule.factor + (rule.offset ?? 0)) : value;
}
export function fromDisplay(
  value: number,
  unit: string,
  system: UnitSystem,
): number {
  const rule = system === "us" ? unitRule(unit) : null;
  return rule ? tidy((value - (rule.offset ?? 0)) / rule.factor) : value;
}
// A difference or step scales but is not offset (a 1 °C step is a 1.8 °F step).
const scaleDelta = (value: number, unit: string, system: UnitSystem) => {
  const rule = system === "us" ? unitRule(unit) : null;
  return rule ? tidy(value * rule.factor) : value;
};

// True when switching systems would change anything the viewer sees.
export function hasConvertibleUnits(e: Experiment): boolean {
  if (!e.generated || e.kind !== "model") return false;
  const units = [
    e.unit,
    e.axisUnit ?? "",
    e.transfer.unit,
    ...(e.inputs?.map((p) => p.unit) ?? []),
    ...(e.formulas?.map((f) => f.unit) ?? []),
  ];
  return units.some(convertible);
}

export type Presented = {
  experiment: Experiment;
  system: UnitSystem;
  convertible: boolean;
  // A value typed in display units → the authored unit, snapped to the input's step grid.
  toBaseInput: (id: string, display: number) => number;
  // The learner's transfer answer in display units → the authored unit.
  toBaseAnswer: (display: number) => number;
};

// The experiment as the viewer should see it. In the lesson's own system this is the
// experiment itself; in US units every number and unit string is converted for display while
// the engine, the model and the checks keep working in the authored units.
export function presentExperiment(
  e: Experiment,
  system: UnitSystem,
): Presented {
  const convertibleHere = hasConvertibleUnits(e);
  const identity: Presented = {
    experiment: e,
    system,
    convertible: convertibleHere,
    toBaseInput: (_id, display) => display,
    toBaseAnswer: (display) => display,
  };
  if (system === "metric" || !convertibleHere) return identity;
  const show = (value: number, unit: string) => toDisplay(value, unit, system);
  const label = (unit: string) => displayUnit(unit, system);
  const inputs = e.inputs?.map((p) => ({
    ...p,
    unit: label(p.unit),
    min: show(p.min, p.unit),
    max: show(p.max, p.unit),
    step: scaleDelta(p.step, p.unit, system),
    value: show(p.value, p.unit),
  }));
  const metrics = e.metrics.map((m) => ({
    ...m,
    value: show(m.value, m.unit),
    unit: label(m.unit),
  }));
  const axisUnit = e.axisUnit ?? "";
  const axis =
    e.axisLabel !== undefined ? `${e.axisLabel} (${label(axisUnit)})` : e.axis;
  const caption =
    e.axisLabel !== undefined && e.xAt && e.outputLabel !== undefined
      ? (u: number) => {
          const x = e.xAt!(u);
          const y = e.sample(u)[0];
          return `${e.axisLabel} = ${fmt(show(x, axisUnit))} ${label(axisUnit)} · ${e.outputLabel} = ${fmt(show(y, e.unit))} ${label(e.unit)}`;
        }
      : e.caption;
  const result =
    e.resultPrefix !== undefined
      ? e.resultPrefix +
        metrics.map((m) => `${m.label} = ${fmt(m.value)} ${m.unit}`).join(" · ")
      : e.result;
  const transferInputs = e.transferInputs
    ?.map((p) => `${p.label} = ${fmt(show(p.value, p.unit))} ${label(p.unit)}`)
    .join(" · ");
  const question =
    e.transferQuestion !== undefined &&
    transferInputs !== undefined &&
    e.transferAt !== undefined
      ? `${e.transferQuestion}\n${transferInputs}\n${e.axisLabel} = ${fmt(show(e.transferAt, axisUnit))} ${label(axisUnit)} → ${e.transferOutputLabel ?? ""}`
      : e.transfer.question;
  const experiment: Experiment = {
    ...e,
    unit: label(e.unit),
    axis,
    axisEnds: e.axisEnds?.map((v) => show(v, axisUnit)),
    inputs,
    formulas: e.formulas?.map((f) => ({ ...f, unit: label(f.unit) })),
    metrics,
    sample: (u) => e.sample(u).map((v) => show(v, e.unit)),
    caption,
    result,
    transfer: {
      ...e.transfer,
      question,
      unit: label(e.transfer.unit),
      answer: show(e.transfer.answer, e.transfer.unit),
      tolerance: scaleDelta(e.transfer.tolerance, e.transfer.unit, system),
    },
  };
  return {
    experiment,
    system,
    convertible: true,
    toBaseInput: (id, display) => {
      const p = e.inputs?.find((input) => input.id === id);
      if (!p) return display;
      const base = fromDisplay(display, p.unit, system);
      const snapped = p.min + Math.round((base - p.min) / p.step) * p.step;
      return tidy(Math.min(p.max, Math.max(p.min, snapped)));
    },
    toBaseAnswer: (display) => fromDisplay(display, e.transfer.unit, system),
  };
}

// The viewer's choice, kept in this browser only; absent until they choose.
const KEY = "explainback.units";
export function rememberedUnitSystem(): UnitSystem | null {
  try {
    const value = localStorage.getItem(KEY);
    return isUnitSystem(value) ? value : null;
  } catch {
    return null;
  }
}
export function rememberUnitSystem(system: UnitSystem): void {
  try {
    localStorage.setItem(KEY, system);
  } catch {
    /* private mode or blocked storage: the choice lasts for this page only */
  }
}

// The lesson without its viewer-facing default, for cache keys and model requests: a default
// unit change alters no computation and must not stale a result or reach the model.
export function withoutUnits<T extends { units?: UnitSystem }>(
  lesson: T,
): Omit<T, "units"> {
  const { units: _units, ...rest } = lesson;
  return rest;
}
