import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { StudioStepper } from "./StudioStepper";

afterEach(cleanup);

describe("StudioStepper", () => {
  it("lists the five steps with their cost, marks the current one and says Done for finished ones", () => {
    render(
      <StudioStepper language="en" current="review" done={{ ask: true }} />,
    );
    const list = screen.getByRole("list", { name: "Creation steps" });
    const items = list.querySelectorAll("li");
    expect(items.length).toBe(5);
    expect(items[0].textContent).toContain("Ask");
    expect(items[0].textContent).toContain("Done");
    expect(items[0].className).toBe("is-complete");
    expect(items[1].getAttribute("aria-current")).toBe("step");
    expect(items[1].textContent).toContain("Review");
    expect(items[1].textContent).toContain("No request");
    expect(items[2].textContent).toContain("Try as a learner");
    expect(items[2].textContent).toContain("1 request");
    expect(items[3].textContent).toContain("1 to 2 requests");
    expect(items[4].textContent).toContain("Save and share");
    cleanup();
    render(<StudioStepper language="zh" current="ask" done={{}} />);
    expect(screen.getByRole("list", { name: "创建步骤" })).toBeTruthy();
    expect(screen.getByText("保存与分享")).toBeTruthy();
  });
});
