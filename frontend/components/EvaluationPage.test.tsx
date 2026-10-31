import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EvaluationPage } from "./EvaluationPage";

afterEach(cleanup);

describe("EvaluationPage", () => {
  it("renders the evaluation card from docs/evaluation.md with its tables and source link", () => {
    render(<EvaluationPage language="en" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Evaluation card" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "What these numbers do not establish",
      }),
    ).toBeTruthy();
    // Both frozen-suite result tables name the two models.
    expect(
      screen.getAllByRole("cell", { name: "muse-wonder-1.0" }).length,
    ).toBe(2);
    expect(screen.getAllByRole("cell", { name: "muse-spark-1.3" }).length).toBe(
      2,
    );
    expect(
      screen.getAllByRole("columnheader", { name: "Checksum (SHA-256)" })
        .length,
    ).toBe(1);
    // The full reports stay on GitHub; the card's own source is linked too.
    expect(
      screen
        .getByRole("link", { name: "studio-breadth-v1-2026-10-31.md" })
        .getAttribute("href"),
    ).toBe(
      "https://github.com/dorangao/explainbackapp/blob/main/docs/evaluation/studio-breadth-v1-2026-10-31.md",
    );
    expect(
      screen
        .getByRole("link", { name: "Source on GitHub" })
        .getAttribute("href"),
    ).toBe(
      "https://github.com/dorangao/explainbackapp/blob/main/docs/evaluation.md",
    );
    expect(
      screen
        .getByRole("link", { name: "Back to library" })
        .getAttribute("href"),
    ).toBe("#studio");
    // The reproduce command is shown as code, not run or linked.
    expect(
      screen.getByText(/npm run eval:studio -- --suite=studio-breadth-v1/),
    ).toBeTruthy();
    cleanup();
    render(<EvaluationPage language="zh" />);
    expect(screen.getByText("评估卡")).toBeTruthy();
    expect(screen.getByText(/正文为英文/)).toBeTruthy();
  });
});
