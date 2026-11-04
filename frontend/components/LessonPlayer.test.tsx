import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { LessonPlayer } from "./LessonPlayer";
import { createLessonPlayer } from "../lib/shared";
import {
  coolingLesson,
  processLesson,
} from "../../test-support/generated-lessons.mjs";
import type { Language, Lesson, ModelDemo } from "../lib/types";
import type { Pace } from "../lib/studio-cache";
import { restorePlayer } from "../lib/studio-store";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function coffee() {
  const lesson = coolingLesson() as Lesson;
  const demo = lesson.chapters[0].demo as ModelDemo;
  demo.transfer.values = [
    { id: "initial", value: 85 },
    { id: "ambient", value: 20 },
    { id: "rate", value: 0.05 },
  ];
  demo.transfer.at = 8;
  return lesson;
}
function mount(
  lesson = coffee(),
  language: Language = "en",
  pace: Pace = "off",
) {
  const player = createLessonPlayer(lesson);
  player.predict("disagree");
  player.next();
  player.scrub(1);
  player.next();
  player.next();
  render(
    <LessonPlayer
      player={player}
      language={language}
      visible
      busy={false}
      canAsk={false}
      pace={pace}
      feedback={null}
      onGuide={() => {
        throw new Error("No model request expected");
      }}
      onClearFeedback={() => {}}
      onBack={() => {}}
      onLibrary={() => {}}
    />,
  );
  return player;
}
for (const language of ["en", "zh"] as const)
  it(`marks an automatic replay answer as assisted and restores that status (${language})`, async () => {
    vi.useFakeTimers();
    try {
      const player = mount(coffee(), language, "fast");
      expect(player.state.assisted).toBe(false);
      fireEvent.click(
        screen.getByRole("button", { name: /Resume replay|继续回放/ }),
      );
      await act(async () => {
        vi.advanceTimersByTime(3100);
      });
      expect(player.state.stage).toBe("complete");
      expect(player.state.assisted).toBe(true);
      expect(
        screen.getByText(
          language === "zh" ? "在帮助下完成" : "Completed with help",
          { exact: true },
        ),
      ).toBeTruthy();
      expect(restorePlayer(player.lesson, player.state).state.assisted).toBe(
        true,
      );
    } finally {
      vi.useRealTimers();
    }
  });

function submit(value: string) {
  fireEvent.change(
    screen.getByRole("textbox", { name: /Your answer|你的答案/ }),
    {
      target: { value },
    },
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Check answer locally|本地核验答案/ }),
  );
}

it("describes the required precision without revealing the answer, and retains the coffee marking", () => {
  const player = mount();
  const answer = screen.getByRole("textbox", { name: "Your answer (°C)" });
  const hint = document.getElementById(
    answer.getAttribute("aria-describedby") ?? "",
  );
  expect(hint?.textContent).toMatch(/nearest 0\.1 °C/);
  expect(hint?.textContent).not.toMatch(/63\.5/);
  submit("64");
  expect(player.state.transfer).toBe(false);
  expect(screen.getByRole("status").textContent).toMatch(
    /fresh-case values.*unit.*rounding/,
  );
  expect(
    screen
      .getByRole("button", { name: /Finish lesson/ })
      .hasAttribute("disabled"),
  ).toBe(true);
  submit("63.6");
  expect(player.state.transfer).toBe(true);
  expect(
    screen
      .getByRole("button", { name: /Finish lesson/ })
      .hasAttribute("disabled"),
  ).toBe(false);
});

it("uses the displayed unit's precision and clears entries/results when units change", () => {
  const player = mount();
  submit("64");
  fireEvent.click(screen.getByRole("button", { name: /US \(°F, ft, lb\)/ }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Your answer (°F)",
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  expect(screen.getByText(/nearest 0\.1 °F/)).toBeTruthy();
  expect(player.state.transfer).toBeNull();
  submit("146.4");
  expect(player.state.transfer).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /^Metric/ }));
  expect(player.state.transfer).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");
});

it("remembers an explicitly selected default unit without clearing the same-unit answer", () => {
  const player = mount();
  submit("63.6");
  fireEvent.click(screen.getByRole("button", { name: /^Metric/ }));
  expect(localStorage.getItem("explainback.units")).toBe("metric");
  expect(
    (
      screen.getByRole("textbox", {
        name: "Your answer (°C)",
      }) as HTMLInputElement
    ).value,
  ).toBe("63.6");
  expect(player.state.transfer).toBe(true);
});

it("provides the precision and fixed-case retry guidance in Chinese", () => {
  const player = mount(coffee(), "zh");
  const answer = screen.getByRole("textbox", { name: "你的答案 (°C)" });
  const hint = document.getElementById(
    answer.getAttribute("aria-describedby") ?? "",
  );
  expect(hint?.textContent).toMatch(/0\.1 °C/);
  expect(hint?.textContent).toMatch(/精度/);
  submit("64");
  expect(screen.getByRole("status").textContent).toMatch(/新情境.*单位.*精度/);
  submit("63.6");
  expect(player.state.transfer).toBe(true);
});

it.each(["", "NaN", "Infinity", "not a number"])(
  "keeps %j invalid instead of grading it as zero",
  (value) => {
    const player = mount();
    submit(value);
    expect(player.state.transfer).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/finite number/);
  },
);

it("asks for an unrounded value when zero has exact tolerance", () => {
  const lesson = coffee();
  (lesson.chapters[0].demo as ModelDemo).outputs[0].expression =
    "initial-initial";
  const player = mount(lesson);
  expect(
    screen.getByText(/full calculated value without rounding/),
  ).toBeTruthy();
  submit("0.0001");
  expect(player.state.transfer).toBe(false);
  submit("0");
  expect(player.state.transfer).toBe(true);
});

it("offers authored-unit recovery when an offset conversion cannot preserve a tiny answer", () => {
  localStorage.setItem("explainback.units", "us");
  const lesson = coffee();
  (lesson.chapters[0].demo as ModelDemo).outputs[0].expression = "1e-12";
  const player = mount(lesson);
  expect(screen.getByText(/unit conversion loses the precision/)).toBeTruthy();
  submit("32");
  expect(player.state.transfer).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: /Show worked steps and answer/ }),
  );
  expect(screen.getByText(/Calculated answer:/).textContent).toBe(
    "Calculated answer: 1e-12 °C",
  );
  fireEvent.click(screen.getByRole("button", { name: "Use lesson units" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Your answer (°C)",
      }) as HTMLInputElement
    ).value,
  ).toBe("");
  expect(player.state.transfer).toBeNull();
  expect(screen.getByText(/nearest 1e-15 °C/)).toBeTruthy();
  submit("0");
  expect(player.state.transfer).toBe(false);
  submit("1e-12");
  expect(player.state.transfer).toBe(true);
});

it("gives a choice-specific retry without numeric precision instructions", () => {
  const player = mount(processLesson() as Lesson);
  fireEvent.click(screen.getByRole("button", { name: "Every request" }));
  expect(player.state.transfer).toBe(false);
  expect(screen.getByRole("status").textContent).toMatch(/try another choice/);
  expect(screen.queryByText(/nearest|full calculated value/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "A new DNS lookup" }));
  expect(player.state.transfer).toBe(true);
});

it("uses the shared calculator on numeric fresh cases without automatically grading or revealing an answer", () => {
  const player = mount();
  fireEvent.click(screen.getByText("Calculator", { selector: "summary" }));
  const expression = screen.getByRole("textbox", { name: "Expression" });
  expect((expression as HTMLInputElement).value).toBe("");
  fireEvent.change(expression, { target: { value: "20+65*exp(-0.05*8)" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(player.state.transfer).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use result (°C)" }));
  expect(
    (
      screen.getByRole("textbox", {
        name: "Your answer (°C)",
      }) as HTMLInputElement
    ).value,
  ).toBe("63.57080299231656");
  expect(player.state.transfer).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check answer locally" }));
  expect(player.state.transfer).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /US \(°F, ft, lb\)/ }));
  expect(
    (screen.getByRole("textbox", { name: "Expression" }) as HTMLInputElement)
      .value,
  ).toBe("");
  expect(
    (
      screen.getByRole("textbox", {
        name: "Your answer (°F)",
      }) as HTMLInputElement
    ).value,
  ).toBe("");
});

it("keeps the calculator out of choice-only fresh cases", () => {
  mount(processLesson() as Lesson);
  expect(screen.queryByText("Calculator", { selector: "summary" })).toBeNull();
});

it("reveals worked steps only on request after an unsuccessful check and records assistance", () => {
  const player = mount();
  expect(
    screen.queryByRole("button", { name: /Show worked steps and answer/ }),
  ).toBeNull();
  submit("59.9");
  expect(screen.queryByText(/Calculated answer:/)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: /Show worked steps and answer/ }),
  );
  expect(screen.getByText(/Calculated answer:/).textContent).toContain(
    "63.57080299231656",
  );
  expect(screen.getByText(/Substitute:/).textContent).toContain("85");
  expect(player.state.assisted).toBe(true);
  submit("63.6");
  fireEvent.click(screen.getByRole("button", { name: /Finish lesson/ }));
  expect(screen.getByText(/Completed with help/)).toBeTruthy();
});

it("starts a new attempt without revealing the earlier solution", () => {
  const player = mount();
  submit("0");
  fireEvent.click(
    screen.getByRole("button", { name: /Show worked steps and answer/ }),
  );
  submit("63.6");
  fireEvent.click(screen.getByRole("button", { name: /Finish lesson/ }));
  fireEvent.click(screen.getByRole("button", { name: /Start over|Restart/i }));
  player.predict("unsure");
  player.next();
  player.scrub(1);
  player.next();
  player.next();
  fireEvent.click(screen.getByRole("button", { name: /Not sure/i }));
  submit("0");
  expect(
    screen.queryByRole("button", { name: /Show worked steps and answer/ }),
  ).not.toBeNull();
  expect(screen.queryByText(/Calculated answer:/)).toBeNull();
});
