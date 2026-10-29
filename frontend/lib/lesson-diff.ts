import type { Bilingual, Language, Lesson, Demo } from "./types";

export type Change = {
  path: string;
  label: Bilingual;
  before: string;
  after: string;
  kind: "text" | "number" | "added" | "removed";
};
const bi = (en: string, zh: string): Bilingual => ({ en, zh });
const show = (value: unknown): string =>
  value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value
      : typeof value === "number"
        ? String(value)
        : JSON.stringify(value);
function text(
  out: Change[],
  path: string,
  label: Bilingual,
  before: Bilingual | undefined,
  after: Bilingual | undefined,
  language: Language,
) {
  const b = before?.[language] ?? "",
    a = after?.[language] ?? "";
  if (b !== a)
    out.push({
      path,
      label,
      before: b,
      after: a,
      kind: !b ? "added" : !a ? "removed" : "text",
    });
}
function scalar(
  out: Change[],
  path: string,
  label: Bilingual,
  before: unknown,
  after: unknown,
) {
  if (show(before) !== show(after))
    out.push({
      path,
      label,
      before: show(before),
      after: show(after),
      kind:
        before === undefined
          ? "added"
          : after === undefined
            ? "removed"
            : typeof after === "number"
              ? "number"
              : "text",
    });
}
function demoChanges(
  out: Change[],
  index: number,
  before: Demo | undefined,
  after: Demo | undefined,
  language: Language,
) {
  const p = `chapters[${index}].demo`;
  if (!before || !after) {
    if (before !== after)
      out.push({
        path: p,
        label: bi("Demo", "演示"),
        before: before ? before.kind : "",
        after: after ? after.kind : "",
        kind: before ? "removed" : "added",
      });
    return;
  }
  if (before.kind !== after.kind) {
    out.push({
      path: `${p}.kind`,
      label: bi("Demo type", "演示类型"),
      before: before.kind,
      after: after.kind,
      kind: "text",
    });
    return;
  }
  text(
    out,
    `${p}.title`,
    bi("Demo title", "演示标题"),
    before.title,
    after.title,
    language,
  );
  text(
    out,
    `${p}.claim`,
    bi("Claim", "观点"),
    before.claim,
    after.claim,
    language,
  );
  text(
    out,
    `${p}.assumptions`,
    bi("Assumptions", "假设"),
    before.assumptions,
    after.assumptions,
    language,
  );
  if (before.kind === "model" && after.kind === "model") {
    const ids = new Set([...before.inputs, ...after.inputs].map((i) => i.id));
    for (const id of ids) {
      const b = before.inputs.find((i) => i.id === id),
        a = after.inputs.find((i) => i.id === id);
      if (!b || !a) {
        scalar(
          out,
          `${p}.inputs.${id}`,
          bi(`Input ${id}`, `输入 ${id}`),
          b && `${b.label[language]} (${b.unit})`,
          a && `${a.label[language]} (${a.unit})`,
        );
        continue;
      }
      text(
        out,
        `${p}.inputs.${id}.label`,
        bi(`Input ${id} label`, `输入 ${id} 标签`),
        b.label,
        a.label,
        language,
      );
      for (const key of ["unit", "min", "max", "step", "value"] as const)
        scalar(
          out,
          `${p}.inputs.${id}.${key}`,
          bi(`Input ${id} ${key}`, `输入 ${id} ${key}`),
          b[key],
          a[key],
        );
    }
    text(
      out,
      `${p}.axis.label`,
      bi("Axis label", "坐标轴标签"),
      before.axis.label,
      after.axis.label,
      language,
    );
    for (const key of ["unit", "min", "max"] as const)
      scalar(
        out,
        `${p}.axis.${key}`,
        bi(`Axis ${key}`, `坐标轴 ${key}`),
        before.axis[key],
        after.axis[key],
      );
    const outputs = new Set(
      [...before.outputs, ...after.outputs].map((o) => o.id),
    );
    for (const id of outputs) {
      const b = before.outputs.find((o) => o.id === id),
        a = after.outputs.find((o) => o.id === id);
      if (!b || !a) {
        scalar(
          out,
          `${p}.outputs.${id}`,
          bi(`Output ${id}`, `输出 ${id}`),
          b && `${b.label[language]} = ${b.expression} (${b.unit})`,
          a && `${a.label[language]} = ${a.expression} (${a.unit})`,
        );
        continue;
      }
      text(
        out,
        `${p}.outputs.${id}.label`,
        bi(`Output ${id} label`, `输出 ${id} 标签`),
        b.label,
        a.label,
        language,
      );
      scalar(
        out,
        `${p}.outputs.${id}.unit`,
        bi(`Output ${id} unit`, `输出 ${id} 单位`),
        b.unit,
        a.unit,
      );
      scalar(
        out,
        `${p}.outputs.${id}.expression`,
        bi(`Output ${id} formula`, `输出 ${id} 公式`),
        b.expression,
        a.expression,
      );
    }
    text(
      out,
      `${p}.transfer.question`,
      bi("Transfer question", "迁移题"),
      before.transfer.question,
      after.transfer.question,
      language,
    );
    scalar(
      out,
      `${p}.transfer.at`,
      bi("Transfer point", "迁移题取值点"),
      before.transfer.at,
      after.transfer.at,
    );
    scalar(
      out,
      `${p}.transfer.output`,
      bi("Transfer output", "迁移题输出"),
      before.transfer.output,
      after.transfer.output,
    );
    const values = new Set(
      [...before.transfer.values, ...after.transfer.values].map((v) => v.id),
    );
    for (const id of values)
      scalar(
        out,
        `${p}.transfer.values.${id}`,
        bi(`Transfer ${id}`, `迁移题 ${id}`),
        before.transfer.values.find((v) => v.id === id)?.value,
        after.transfer.values.find((v) => v.id === id)?.value,
      );
  } else if (before.kind === "process" && after.kind === "process") {
    const n = Math.max(before.stages.length, after.stages.length);
    for (let i = 0; i < n; i++) {
      const b = before.stages[i],
        a = after.stages[i];
      text(
        out,
        `${p}.stages[${i}].title`,
        bi(`Stage ${i + 1} title`, `步骤 ${i + 1} 标题`),
        b?.title,
        a?.title,
        language,
      );
      text(
        out,
        `${p}.stages[${i}].detail`,
        bi(`Stage ${i + 1} detail`, `步骤 ${i + 1} 说明`),
        b?.detail,
        a?.detail,
        language,
      );
    }
    text(
      out,
      `${p}.transfer.question`,
      bi("Transfer question", "迁移题"),
      before.transfer.question,
      after.transfer.question,
      language,
    );
    const m = Math.max(
      before.transfer.choices.length,
      after.transfer.choices.length,
    );
    for (let i = 0; i < m; i++)
      text(
        out,
        `${p}.transfer.choices[${i}]`,
        bi(`Choice ${i + 1}`, `选项 ${i + 1}`),
        before.transfer.choices[i],
        after.transfer.choices[i],
        language,
      );
    scalar(
      out,
      `${p}.transfer.answer`,
      bi("Correct choice", "正确选项"),
      before.transfer.answer + 1,
      after.transfer.answer + 1,
    );
    text(
      out,
      `${p}.transfer.rationale`,
      bi("Rationale", "理由"),
      before.transfer.rationale,
      after.transfer.rationale,
      language,
    );
  }
}
// Field-level changes between two validated lessons, in the given language. Pure; no
// scientific judgement. Used to show what a Muse revision (or an author edit) changed.
export function lessonChanges(
  before: Lesson,
  after: Lesson,
  language: Language,
): Change[] {
  const out: Change[] = [];
  text(
    out,
    "title",
    bi("Lesson title", "课程标题"),
    before.title,
    after.title,
    language,
  );
  text(
    out,
    "intro",
    bi("Introduction", "简介"),
    before.intro,
    after.intro,
    language,
  );
  const n = Math.max(before.chapters.length, after.chapters.length);
  for (let i = 0; i < n; i++) {
    const b = before.chapters[i],
      a = after.chapters[i];
    if (!b || !a) {
      out.push({
        path: `chapters[${i}]`,
        label: bi(`Chapter ${i + 1}`, `章节 ${i + 1}`),
        before: b ? b.experiment : "",
        after: a ? a.experiment : "",
        kind: b ? "removed" : "added",
      });
      continue;
    }
    scalar(
      out,
      `chapters[${i}].experiment`,
      bi(`Chapter ${i + 1} experiment`, `章节 ${i + 1} 实验`),
      b.experiment,
      a.experiment,
    );
    text(
      out,
      `chapters[${i}].framing`,
      bi(`Chapter ${i + 1} framing`, `章节 ${i + 1} 情境`),
      b.framing,
      a.framing,
      language,
    );
    text(
      out,
      `chapters[${i}].explanation`,
      bi(`Chapter ${i + 1} explanation`, `章节 ${i + 1} 解释`),
      b.explanation,
      a.explanation,
      language,
    );
    demoChanges(out, i, b.demo, a.demo, language);
  }
  return out;
}
