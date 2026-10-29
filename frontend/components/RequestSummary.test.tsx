import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RequestSummary } from "./RequestSummary";

afterEach(cleanup);
describe("RequestSummary", () => {
  it("shows the model's own account of its reasoning, labelled unverified, only when present", () => {
    const { unmount } = render(
      <RequestSummary
        language="en"
        metrics={{
          model: "muse-wonder-1.0",
          elapsedMs: 2900,
          usage: { input: 1200, output: 800, cached: 1000 },
          reasoning: "Chose one chapter because the topic has one claim.",
          mode: "compose",
          at: 1,
        }}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(
      /muse-wonder-1\.0 drafted this lesson · 2\.9 s · 1 request · 1200 tokens in \/ 800 out · 1000 from cache/,
    );
    expect(document.querySelector(".model-account")?.textContent).toMatch(
      /The model's own account of its reasoning, unverified: Chose one chapter/,
    );
    unmount();
    render(
      <RequestSummary
        language="zh"
        metrics={{
          model: "m",
          elapsedMs: 100,
          usage: null,
          reasoning: null,
          mode: "show",
          at: 1,
        }}
      />,
    );
    expect(document.querySelector(".model-account")).toBeNull();
  });
});
