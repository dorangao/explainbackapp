import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Spotlight } from "./Spotlight";

afterEach(cleanup);
describe("Spotlight", () => {
  it("draws SAM boxes over the image in image pixels and sends the named concept", () => {
    const onFind = vi.fn();
    render(
      <Spotlight
        language="en"
        image="data:image/png;base64,QUJD"
        detection={{
          concept: "pendulum",
          boxes: [{ x1: 10, y1: 20, x2: 109, y2: 219 }],
          width: 640,
          height: 480,
          model: "sam-3.1",
        }}
        onFind={onFind}
      />,
    );
    const svg = document.querySelector(".spotlight-boxes");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 640 480");
    const rect = svg?.querySelector("rect");
    expect(rect?.getAttribute("width")).toBe("100");
    expect(rect?.getAttribute("height")).toBe("200");
    expect(screen.getByRole("status").textContent).toMatch(
      /found 1 × “pendulum”/,
    );
    const input = screen.getByLabelText("What to find in the image");
    expect((input as HTMLInputElement).value).toBe("pendulum");
    fireEvent.change(input, { target: { value: " coffee cup " } });
    fireEvent.click(screen.getByRole("button", { name: "Find with SAM 3.1" }));
    expect(onFind).toHaveBeenCalledWith("coffee cup");
  });
  it("reports an empty result and hides the search for viewers who cannot request", () => {
    render(
      <Spotlight
        language="zh"
        image="data:image/png;base64,QUJD"
        detection={{
          concept: "独角兽",
          boxes: [],
          width: 640,
          height: 480,
          model: "sam-3.1",
        }}
      />,
    );
    expect(document.querySelector(".spotlight-boxes")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(
      /没有在这张图片中找到/,
    );
  });
});
