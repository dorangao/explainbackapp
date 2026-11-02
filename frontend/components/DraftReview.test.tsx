import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SourcesPanel } from "./DraftReview";
import type { ReferenceFact } from "../lib/types";

afterEach(cleanup);

it("replaces sourced facts without retaining stale rows when values share a page", () => {
  const fact = (en: string, value = "1"): ReferenceFact => ({
    statement: { en, zh: en },
    value,
    unit: "1",
    url: "https://example.org/oscillator",
    title: "Example figures",
  });
  const frequency = fact("Frequency ratio"),
    damping = fact("Damping ratio"),
    replacement = fact("Replacement ratio", "2");
  const panel = (facts: ReferenceFact[]) => (
    <SourcesPanel
      language="en"
      sources={undefined}
      references={{ asOf: "2026-10-31", facts }}
    />
  );
  const { rerender } = render(panel([frequency, damping]));
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  rerender(panel([replacement, damping]));
  expect(screen.queryByText("Frequency ratio")).toBeNull();
  expect(screen.getByText("Replacement ratio")).toBeTruthy();
  expect(screen.getByText("Damping ratio")).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
