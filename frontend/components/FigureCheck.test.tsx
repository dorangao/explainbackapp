import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FigureCheck } from "./FigureCheck";
import type { JudgeReply } from "../lib/types";

afterEach(cleanup);

const reply: JudgeReply = {
  judge: {
    model: "muse-spark-1.3",
    version: "studio-judge-v2",
    total: 11,
    max: 12,
    scores: {
      neutralFraming: 2,
      quantityNames: 2,
      transferClarity: 2,
      bilingualParity: 2,
      assumptions: 2,
      factualCurrency: 1,
    },
    issues: ['Chapter 2: "Newton" appears only in English.'],
    summary: "One figure looks stale.",
    factualIssues: [
      {
        claim: "0.1 per minute",
        finding: "Typical coffee cools nearer 0.05 per minute.",
        url: "https://example.org/cooling",
        verified: true,
      },
      {
        claim: "20 °C room",
        finding: "Unsourced.",
        url: "https://example.org/room",
        verified: false,
      },
    ],
    pagesRead: 2,
  },
  grounded: true,
  elapsedMs: 4200,
  usage: { input: 900, output: 120 },
  attemptsRemaining: 7,
};

describe("FigureCheck", () => {
  it("runs the check on request and lists the disputed figures with their pages", async () => {
    const onCheck = vi.fn(async () => reply);
    render(<FigureCheck language="en" busy={false} onCheck={onCheck} />);
    expect(
      screen.getByRole("heading", { name: "Check figures against the web" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check figures" }));
    expect(onCheck).toHaveBeenCalledTimes(1);
    await screen.findByText(/Figures up to date/);
    const score = screen.getByText(/Figures up to date/).closest("p");
    expect(score?.textContent).toContain("1/2");
    expect(score?.textContent).toContain("11/12");
    expect(score?.textContent).toContain("Spark");
    expect(score?.textContent).toContain("2 pages read");
    expect(screen.getByText("0.1 per minute")).toBeTruthy();
    const links = screen.getAllByRole("link", { name: "source" });
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.org/cooling",
      "https://example.org/room",
    ]);
    expect(screen.getByText(/page not among the search results/)).toBeTruthy();
    expect(screen.getByText(/"Newton" appears only in English/)).toBeTruthy();
    expect(screen.getByText("One figure looks stale.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check again" })).toBeTruthy();
  });
  it("keeps the button disabled while busy and says nothing was disputed when the list is empty", async () => {
    const clean: JudgeReply = {
      ...reply,
      judge: { ...reply.judge, factualIssues: [], issues: [], total: 12 },
    };
    const onCheck = vi.fn(async () => clean);
    const { rerender } = render(
      <FigureCheck language="zh" busy={true} onCheck={onCheck} />,
    );
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
    rerender(<FigureCheck language="zh" busy={false} onCheck={onCheck} />);
    fireEvent.click(screen.getByRole("button", { name: "核对数值" }));
    await screen.findByText(/12\/12/);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/未发现/)).toBeTruthy();
  });
});

describe("FigureCheck while another Muse request runs", () => {
  it("keeps its plain label while disabled, and says it is checking only for its own request", () => {
    const onCheck = vi.fn(async () => reply);
    const { rerender } = render(
      <FigureCheck language="en" busy={true} onCheck={onCheck} />,
    );
    const button = screen.getByRole("button", { name: "Check figures" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <FigureCheck
        language="en"
        busy={true}
        working={true}
        onCheck={onCheck}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Muse Spark is checking…" }),
    ).toBeTruthy();
  });
});
