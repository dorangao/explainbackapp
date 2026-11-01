import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { JudgePath } from "./JudgePath";
import { judgeStepStates } from "../lib/judge-path";

afterEach(cleanup);

const afterDraft = judgeStepStates({
  hasDraft: true,
  tryoutFresh: false,
  showFresh: false,
  illustrated: false,
  imagesAvailable: true,
  saved: false,
  shared: false,
});

describe("JudgePath as a flow", () => {
  it("draws six bubbles with a word and a hint, checks the finished step and marks the next one current", () => {
    render(
      <JudgePath
        language="en"
        steps={afterDraft}
        running={false}
        used={1}
        onRun={() => {}}
        onRunAll={() => {}}
      />,
    );
    const bubbles = document.querySelectorAll(".judge-steps li");
    expect(bubbles).toHaveLength(6);
    expect(
      [...bubbles].map((li) => li.querySelector(".flow-label")?.textContent),
    ).toEqual(["Draft", "Try", "Narrate", "Illustrate", "Save", "Share"]);
    expect(bubbles[0].getAttribute("data-state")).toBe("done");
    expect(bubbles[0].className).toBe("is-complete");
    expect(bubbles[0].querySelector(".flow-hint")?.textContent).toBe("Done");
    expect(bubbles[1].getAttribute("aria-current")).toBe("step");
    expect(bubbles[1].className).toBe("is-current");
    expect(bubbles[1].querySelector(".flow-hint")?.textContent).toBe(
      "1 request",
    );
    expect(bubbles[4].querySelector(".flow-hint")?.textContent).toBe(
      "No request",
    );
    // The hover tip and the disclosure card both say what the step proves.
    expect(bubbles[2].querySelector(".flow-tip")?.textContent).toContain(
      "Shows:",
    );
    expect(
      screen.getByRole("button", { name: "Run next: Try it as a learner" }),
    ).toBeTruthy();
    expect(screen.getByText("What each step shows")).toBeTruthy();
    expect(document.querySelectorAll(".judge-cards li")).toHaveLength(6);
  });

  it("reminds the creator to review the draft on the Draft bubble until it is reviewed", () => {
    const { rerender } = render(
      <JudgePath
        language="en"
        steps={afterDraft}
        running={false}
        used={1}
        reviewed={false}
        onRun={() => {}}
        onRunAll={() => {}}
      />,
    );
    const draft = document.querySelector(".judge-steps li")!;
    expect(draft.getAttribute("data-review")).toBe("true");
    expect(draft.querySelector(".flow-hint")?.textContent).toBe(
      "Review the draft below",
    );
    expect(
      document.querySelector(".judge-cards li .judge-cost")?.textContent,
    ).toBe("Done · Review the draft below");
    rerender(
      <JudgePath
        language="en"
        steps={afterDraft}
        running={false}
        used={1}
        reviewed
        onRun={() => {}}
        onRunAll={() => {}}
      />,
    );
    expect(draft.getAttribute("data-review")).toBeNull();
    expect(draft.querySelector(".flow-hint")?.textContent).toBe("Done");
  });

  it("shows visitors the flow without the Run buttons or the request tally, and runs a step from a card for reviewers", () => {
    render(
      <JudgePath
        language="zh"
        steps={afterDraft}
        running={false}
        used={1}
        actions={false}
        onRun={() => {}}
        onRunAll={() => {}}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector(".judge-foot")).toBeNull();
    expect(screen.getByText("试学")).toBeTruthy();
    cleanup();
    const onRun = vi.fn();
    render(
      <JudgePath
        language="en"
        steps={afterDraft}
        running={false}
        used={1}
        onRun={onRun}
        onRunAll={() => {}}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Run" })[0]);
    expect(onRun).toHaveBeenCalledWith("tryout");
  });
});
