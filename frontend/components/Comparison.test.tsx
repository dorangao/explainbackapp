import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Comparison, ModelColumn } from "./Comparison";
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
  it("shows the grounded judge's sixth score and the figures it disputed with their sources", () => {
    const pair = evaluationComparisons.find(
      (c) => c.caseId === "logistic-growth-en",
    )!;
    const base = evaluationLesson(pair.ids[0])!;
    render(
      <ModelColumn
        language="en"
        item={{
          id: "live",
          model: base.model,
          status: "ready",
          checksPassed: true,
          lesson: base.lesson,
          kind: "model",
          judge: {
            ...base.judge,
            total: 11,
            max: 12,
            scores: { ...base.judge.scores, factualCurrency: 1 },
            factualIssues: [
              {
                claim: "half-life 5730 years",
                finding: "5700 ± 30 years (Wikipedia, 2026).",
                url: "https://en.wikipedia.org/wiki/Carbon-14",
                verified: true,
              },
              {
                claim: "rate 5%",
                finding: "No page found.",
                url: null,
                verified: false,
              },
            ],
            pagesRead: 4,
          },
          latencyMs: 2100,
          tokens: { input: 900, output: 300 },
        }}
      />,
    );
    expect(screen.getByText("AI wording rubric · 11/12")).toBeTruthy();
    expect(screen.getByText("Figures up to date")).toBeTruthy();
    expect(screen.getByText("Figures the judge disputed")).toBeTruthy();
    expect(screen.getByText("half-life 5730 years")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "source" }).getAttribute("href"),
    ).toBe("https://en.wikipedia.org/wiki/Carbon-14");
    expect(screen.getByText(/No page found/)).toBeTruthy();
    expect(screen.getByText(/searched the web before scoring/)).toBeTruthy();
    cleanup();
    // A plain judge shows five rows and no figures block.
    render(
      <ModelColumn
        language="en"
        item={{
          id: "plain",
          model: base.model,
          status: "ready",
          checksPassed: true,
          lesson: base.lesson,
          kind: "model",
          judge: base.judge,
          latencyMs: 2100,
          tokens: null,
        }}
      />,
    );
    expect(screen.queryByText("Figures up to date")).toBeNull();
    expect(screen.queryByText("Figures the judge disputed")).toBeNull();
  });
  it("renders nothing for an unknown case", () => {
    const { container } = render(<Comparison caseId="nope" language="en" />);
    expect(container.innerHTML).toBe("");
  });
});
