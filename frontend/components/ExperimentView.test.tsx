import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ExperimentView } from "./ExperimentView";
import type { Experiment } from "../lib/types";

afterEach(cleanup);

// The fields the chart reads; the rest of a lesson's experiment is not needed here.
const cooling = {
  title: "Newton cooling",
  unit: "°C",
  axis: "Time (min)",
  steps: 30,
  series: ["Temperature"],
  sample: (u: number) => [20 + 60 * Math.exp(-3 * u)],
} as unknown as Experiment;

describe("ExperimentView", () => {
  it("draws the curve and the progress line when not previewing", () => {
    const { container } = render(
      <ExperimentView
        experiment={cooling}
        progress={0.5}
        language="en"
        interactive={false}
        onScrub={() => {}}
      />,
    );
    expect(container.querySelectorAll("path").length).toBe(1);
    expect(
      screen.queryByText("The curve appears after you predict"),
    ).toBeNull();
    expect(
      screen.getByRole("img", { name: "Newton cooling · °C" }),
    ).toBeTruthy();
  });

  it("hides the result in preview mode: no curve, the starting point and a note", () => {
    const { container } = render(
      <ExperimentView
        experiment={cooling}
        progress={0}
        language="en"
        interactive={false}
        preview
        onScrub={() => {}}
      />,
    );
    expect(container.querySelectorAll("path").length).toBe(0);
    expect(container.querySelectorAll("circle").length).toBe(1);
    expect(
      screen.getByText("The curve appears after you predict"),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: "Newton cooling · °C · result hidden until you predict",
      }),
    ).toBeTruthy();
    // The legend still reads the starting value.
    expect(container.querySelector(".chart-legend strong")?.textContent).toBe(
      "80",
    );
  });
});
