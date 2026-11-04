import {
  compileExpression,
  evaluateExpression,
} from "../../public/demo-model.mjs";
import { formatDemoNumber, shownUnit } from "./shared";
import { displayUnit, toDisplay, type UnitSystem } from "./units";
import type { Experiment, Language } from "./types";

const fixedSteps: Record<string, string> = {
  acceleration: "½ × 12 × 3 = 18 m",
  roll: "200 × 1.5 = 300 N·m",
  landing: "100 × 2 / 0.5 = 400 N",
  suction: "0.5 × 20 = 10 N",
  qubit: "1000 × 0.5 = 500",
  interference: "[1 + cos(π/2)] / 2 = 0.5 = 50%",
  entanglement: "800 × ¼ = 200",
  search: "|1/4|² = 1/16 = 6.25%",
};

export function workedTransfer(
  e: Experiment,
  units: UnitSystem,
  language: Language = "en",
): string[] {
  const zh = language === "zh";
  const lines: string[] = [];
  if (e.transfer.type === "choice") {
    return [
      e.transfer.choices?.[e.transfer.answer] ?? "",
      e.transfer.hint ?? "",
    ];
  }
  if (
    e.generated &&
    e.inputs &&
    e.transferInputs &&
    e.formulas &&
    e.transferAt !== undefined
  ) {
    const env: Record<string, number> = { x: e.transferAt };
    e.inputs.forEach((input, i) => {
      env[input.id] = e.transferInputs![i].value;
    });
    lines.push(
      (zh
        ? "已知（公式使用原始单位）："
        : "Given (in the formula’s authored units): ") +
        e.transferInputs
          .map(
            (i, index) =>
              `${i.label} (${e.inputs![index].id}) = ${i.value}${shownUnit(i.unit) ? ` ${i.unit}` : ""}`,
          )
          .join(" · ") +
        ` · ${e.axisLabel ?? "x"} (x) = ${e.transferAt}${shownUnit(e.axisUnit ?? "") ? ` ${e.axisUnit}` : ""}`,
    );
    for (const f of e.formulas) {
      const expression = f.expression;
      const substituted = expression.replace(
        /\b[A-Za-z_][A-Za-z_0-9]*\b/g,
        (word) => (Object.hasOwn(env, word) ? `(${env[word]})` : word),
      );
      const value = evaluateExpression(
        compileExpression(expression, Object.keys(env)),
        env,
      );
      lines.push(`${f.label}: ${expression}`);
      lines.push(
        `${zh ? "代入" : "Substitute"}: ${substituted} ≈ ${formatDemoNumber(value)}${shownUnit(f.unit) ? ` ${f.unit}` : ""}`,
      );
      env[f.id] = value;
      if (f.label === e.transferOutputLabel && f.expression === e.transfer.hint)
        break;
    }
  } else {
    if (e.transfer.hint)
      lines.push(`${zh ? "公式" : "Formula"}: ${e.transfer.hint}`);
    if (fixedSteps[e.id])
      lines.push(`${zh ? "代入" : "Substitute"}: ${fixedSteps[e.id]}`);
  }
  const system = e.generated ? units : "metric";
  const value = toDisplay(e.transfer.answer, e.transfer.unit, system);
  const unit = displayUnit(e.transfer.unit, system);
  lines.push(
    `${zh ? "计算答案" : "Calculated answer"}: ${value}${shownUnit(unit) ? ` ${unit}` : ""}`,
  );
  return lines;
}
