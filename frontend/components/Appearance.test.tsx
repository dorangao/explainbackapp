import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Appearance } from "./Appearance";

beforeEach(() => {
  localStorage.clear();
  window.explainbackAppearance.select({
    theme: "paper",
    reduceTransparency: false,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("chooses a persistent appearance without remounting sibling content", () => {
  render(
    <>
      <Appearance language="en" />
      <input aria-label="Draft" defaultValue="Unsaved lesson" />
    </>,
  );
  const draft = screen.getByRole("textbox", { name: "Draft" });
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
  fireEvent.click(screen.getByRole("radio", { name: "Midnight Paper" }));
  expect(document.documentElement.dataset.theme).toBe("midnight");
  expect(
    JSON.parse(localStorage.getItem("explainback-appearance")!).theme,
  ).toBe("midnight");
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  expect((draft as HTMLInputElement).value).toBe("Unsaved lesson");
  fireEvent.keyDown(screen.getByRole("group", { name: "Theme" }), {
    key: "Escape",
  });
  expect(screen.queryByRole("radio")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Appearance" }),
  );
});

test("offers translated names and a persisted glass transparency preference", () => {
  render(<Appearance language="zh" />);
  fireEvent.click(screen.getByRole("button", { name: "外观" }));
  fireEvent.click(screen.getByRole("radio", { name: "液态玻璃" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "减少透明效果" }));
  expect(document.documentElement.dataset.reduceTransparency).toBe("true");
  expect(
    JSON.parse(localStorage.getItem("explainback-appearance")!)
      .reduceTransparency,
  ).toBe(true);
  fireEvent.click(screen.getByRole("radio", { name: "纸感 默认" }));
  expect(screen.queryByRole("checkbox")).toBeNull();
});

test("dismisses outside the picker and remains usable if storage throws", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  render(<Appearance language="en" />);
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
  fireEvent.click(screen.getByRole("radio", { name: "Meta Blue" }));
  expect(document.documentElement.dataset.theme).toBe("meta");
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("radio")).toBeNull();
});
