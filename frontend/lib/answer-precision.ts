import type { Experiment } from "./types";
import type { Presented } from "./units";

type AnswerPrecision =
  { kind: "round"; step: string } | { kind: "full" } | { kind: "authored" };

// Recommend precision, never a wider marking tolerance or the answer itself.
export function answerPrecision(
  base: Experiment,
  presented: Presented,
): AnswerPrecision | null {
  if (base.transfer.type === "choice") return null;
  const shown = presented.experiment.transfer;
  const accepted = (value: number) =>
    Number.isFinite(value) &&
    Math.abs(presented.toBaseAnswer(value) - base.transfer.answer) <=
      base.transfer.tolerance;
  // An offset conversion can erase tiny values. More decimal places cannot fix that.
  if (!accepted(shown.answer)) return { kind: "authored" };
  if (shown.tolerance > 0 && Number.isFinite(shown.tolerance)) {
    const exponent = Math.floor(Math.log10(shown.tolerance));
    const step = Number(`1e${exponent}`);
    // At most half a step of rounding error leaves a margin inside the tolerance.
    const rounded = Math.round(shown.answer / step) * step;
    if (step > 0 && accepted(rounded))
      return { kind: "round", step: String(step) };
  }
  return { kind: "full" };
}
