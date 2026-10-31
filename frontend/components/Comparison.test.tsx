import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Comparison } from "./Comparison";
import { evaluationComparisons, evaluationLesson } from "../lib/shared";

afterEach(cleanup);

describe("Comparison", () => {
  it("shows both models' replies to one question with the judge's scores and issues, in either language", () => {
    const pair = evaluationComparisons.find(
      (c) => c.caseId === "logistic-growth-en",
    )!;
    const [wonder, spark] = pair.ids.map((id) => evaluationLesson(id)!);
    render(<Comparison caseId="logistic-growth-en" language="en" />);
    expect(
      screen.getByRole("heading", { name: "Compare the two models" }),
    ).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Muse Wonder" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: "Muse Spark" })).toBeTruthy();
    expect(screen.getByText(wonder.question.en)).toBeTruthy();
    for (const summary of screen.getAllByText("Lesson and rubric details"))
      fireEvent.click(summary);
    expect(
      screen.getByRole("heading", { name: wonder.lesson.title.en }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: spark.lesson.title.en }),
    ).toBeTruthy();
    expect(
      screen.getByText(`AI wording rubric · ${wonder.judge.total}/10`),
    ).toBeTruthy();
    expect(
      screen.getByText(`AI wording rubric · ${spark.judge.total}/10`),
    ).toBeTruthy();
    for (const issue of spark.judge.issues)
      expect(screen.getByText(issue)).toBeTruthy();
    expect(screen.getByText("no issues raised")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: `Open lesson: ${spark.lesson.title.en}` })
        .getAttribute("href"),
    ).toBe(`#lesson:${spark.id}`);
    expect(
      screen
        .getByRole("link", { name: "Evaluation card" })
        .getAttribute("href"),
    ).toBe("#evaluation");
    cleanup();
    render(<Comparison caseId="logistic-growth-en" language="zh" />);
    expect(screen.getByRole("heading", { name: "比较两个模型" })).toBeTruthy();
    expect(screen.getByText("同一问题，两个模型")).toBeTruthy();
  });
  it("renders nothing for an unknown case", () => {
    const { container } = render(<Comparison caseId="nope" language="en" />);
    expect(container.innerHTML).toBe("");
  });
});
