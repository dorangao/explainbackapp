import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CurrencyNote } from "./CurrencyNote";

afterEach(cleanup);

describe("CurrencyNote", () => {
  it("names the drafting date on a dated lesson, says why a stable one needs none, and renders nothing without a mark", () => {
    render(
      <CurrencyNote
        language="en"
        currency={{ status: "dated", asOf: "2026-10-31" }}
      />,
    );
    const dated = screen.getByText(
      "Figures as of 2026-10-31; they may have changed since.",
    );
    expect(dated.getAttribute("data-status")).toBe("dated");
    cleanup();
    render(
      <CurrencyNote
        language="zh"
        currency={{ status: "stable", asOf: "2026-10-31" }}
      />,
    );
    expect(screen.getByText(/作者标记为稳定/)).toBeTruthy();
    cleanup();
    const { container } = render(
      <CurrencyNote language="en" currency={undefined} />,
    );
    expect(container.textContent).toBe("");
  });
});
