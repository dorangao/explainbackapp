import { expect, it } from "vitest";
import { createLessonPlayer } from "./shared";
import { coolingLesson } from "../../test-support/generated-lessons.mjs";
import { workedTransfer } from "./worked-transfer";

it("substitutes the actual fresh values and shows converted display answers", () => {
  const player = createLessonPlayer(coolingLesson());
  player.input("initial", 90);
  const e = player.experiment();
  const lines = workedTransfer(e, "us");
  expect(lines.join(" ")).toContain("(" + e.transferInputs![0].value + ")");
  expect(lines.join(" ")).toContain("°F");
  expect(lines.join(" ")).toContain("°C");
});

it("keeps catalog answers in their authored units when US units are selected", () => {
  const lesson = coolingLesson();
  lesson.chapters[0] = {
    experiment: "acceleration",
    framing: { en: "Test", zh: "测试" },
    explanation: { en: "Test", zh: "测试" },
  } as never;
  const player = createLessonPlayer(lesson);
  expect(workedTransfer(player.experiment(), "us").join(" ")).toContain("18 m");
  expect(workedTransfer(player.experiment(), "us").join(" ")).not.toContain(
    "ft",
  );
});

it("evaluates output dependencies with the actual fresh case in Chinese", () => {
  const lesson = coolingLesson();
  const demo = lesson.chapters[0].demo;
  demo.outputs.unshift({
    id: "difference",
    label: { en: "Temperature difference", zh: "温差" },
    unit: "°C",
    expression: "initial - ambient",
  });
  demo.outputs[1].expression = "ambient + difference * exp(-rate * x)";
  demo.transfer.values = [
    { id: "initial", value: 90 },
    { id: "ambient", value: 15 },
    { id: "rate", value: 0.05 },
  ];
  const player = createLessonPlayer(lesson);
  const lines = workedTransfer(player.experiment("zh"), "metric", "zh");
  expect(lines.join(" ")).toContain("初始温度 (initial) = 90 °C");
  expect(lines.join(" ")).toContain("时间 (x) = 10 min");
  expect(lines.join(" ")).toContain("(15) + (75) * exp(-(0.05) * (10))");
  expect(lines.at(-1)).toBe("计算答案: 60.48979947844751 °C");
});
