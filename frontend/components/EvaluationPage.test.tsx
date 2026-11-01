import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { EvaluationPage } from "./EvaluationPage";

afterEach(cleanup);

describe("EvaluationPage", () => {
  it("renders the evaluation card from docs/evaluation.md with its suite checksums and source link, without private run reports", () => {
    render(<EvaluationPage language="en" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Evaluation card" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "What these checks do not establish",
      }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("columnheader", { name: "Checksum (SHA-256)" })
        .length,
    ).toBe(1);
    // Public methods must not link to dated reports or expose run aggregates.
    expect(screen.queryByRole("heading", { name: "Results" })).toBeNull();
    expect(document.querySelector('a[href*="/docs/evaluation/"]')).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Source on GitHub" })
        .getAttribute("href"),
    ).toBe(
      "https://github.com/dorangao/explainbackapp/blob/main/docs/evaluation.md",
    );
    expect(
      screen
        .getByRole("navigation", { name: "Breadcrumb" })
        .querySelector('a[href="#studio"]')?.textContent,
    ).toBe("Library");
    // The reproduce command is shown as code, not run or linked.
    expect(
      screen.getByText(/npm run eval:studio -- --suite=studio-breadth-v1/),
    ).toBeTruthy();
    cleanup();
    render(<EvaluationPage language="zh" />);
    expect(screen.getAllByText("评估卡").length).toBeGreaterThan(0);
    expect(screen.getByText(/正文为英文/)).toBeTruthy();
  });
});
