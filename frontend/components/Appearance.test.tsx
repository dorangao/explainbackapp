import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Appearance } from "./Appearance";

beforeEach(() => {
  localStorage.clear();
  window.explainbackAppearance.select({
    theme: "paper",
    mode: "system",
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
  fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
  fireEvent.click(screen.getByRole("radio", { name: "Meta Blue" }));
  expect(document.documentElement.dataset.theme).toBe("meta");
  expect(document.documentElement.dataset.colorScheme).toBe("dark");
  expect(JSON.parse(localStorage.getItem("explainback-appearance")!).mode).toBe(
    "dark",
  );
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  expect((draft as HTMLInputElement).value).toBe("Unsaved lesson");
  fireEvent.keyDown(screen.getByRole("group", { name: "Theme" }), {
    key: "Escape",
  });
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
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
  fireEvent.click(screen.getByRole("radio", { name: "深色" }));
  expect(screen.getByRole("status").textContent).toContain("手动");
  fireEvent.click(screen.getByRole("radio", { name: "纸感" }));
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
  expect(screen.queryAllByRole("radio")).toHaveLength(0);
});

test("external preference changes update the selected mode, theme and status", () => {
  render(<Appearance language="en" />);
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "explainback-appearance",
        newValue: JSON.stringify({
          theme: "glass",
          mode: "dark",
          reduceTransparency: true,
        }),
        storageArea: localStorage,
      }),
    );
  });
  expect(
    (
      screen.getByRole("radio", {
        name: "Dark",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(
    (screen.getByRole("radio", { name: "Liquid Glass" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Reduce transparency",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("Dark");
});
