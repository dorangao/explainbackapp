import { describe, expect, it } from "vitest";
import { judgeBlocker, judgeStepStates } from "./judge-path";

describe("judgeStepStates", () => {
  const base = {
    hasDraft: true,
    tryoutFresh: true,
    showFresh: true,
    illustrated: true,
    imagesAvailable: true,
    saved: true,
    shared: true,
  };
  it("marks present results done and only missing ones as requests", () => {
    expect(judgeStepStates(base).map((s) => s.state)).toEqual(
      Array(6).fill("done"),
    );
    const fresh = judgeStepStates({
      ...base,
      hasDraft: false,
      tryoutFresh: false,
      showFresh: false,
      illustrated: false,
      saved: false,
      shared: false,
    });
    expect(fresh.map((s) => s.state)).toEqual(Array(6).fill("todo"));
    expect(fresh.filter((s) => s.request)).toHaveLength(4);
  });
  it("needs a current show before an illustration counts, and marks it unavailable without an image model", () => {
    expect(
      judgeStepStates({ ...base, showFresh: false }).find(
        (s) => s.id === "illustrate",
      )?.state,
    ).toBe("todo");
    expect(
      judgeStepStates({ ...base, imagesAvailable: false }).find(
        (s) => s.id === "illustrate",
      )?.state,
    ).toBe("unavailable");
  });
  it("names the blocker only while a request step is still to do", () => {
    const steps = judgeStepStates({ ...base, saved: false, shared: false });
    expect(judgeBlocker(steps, 0, 0)).toBeNull();
    const pending = judgeStepStates({ ...base, showFresh: false });
    expect(judgeBlocker(pending, 0, 5)).toBe("hour");
    expect(judgeBlocker(pending, 3, 0)).toBe("session");
    expect(judgeBlocker(pending, null, 0)).toBe("session");
    expect(judgeBlocker(pending, 3, 2)).toBeNull();
  });
});
