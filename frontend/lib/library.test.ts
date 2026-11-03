import { describe, expect, it } from "vitest";
import { lessonModelLabel } from "./library";

describe("saved model attribution", () => {
  it("distinguishes the lesson model from an ambiguous legacy value", () => {
    expect(lessonModelLabel({ model: "old", lessonModel: "spark" }, "en")).toBe(
      "Latest lesson model: spark",
    );
    expect(lessonModelLabel({ model: "old" }, "en")).toBe(
      "Recorded model (role unknown): old",
    );
    expect(lessonModelLabel({ model: null }, "zh")).toBeNull();
    expect(lessonModelLabel({ model: "old" }, "zh")).toContain("角色未知");
  });
});
