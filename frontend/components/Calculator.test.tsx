import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Calculator } from "./Calculator";
afterEach(cleanup);

function setup() {
  const use = vi.fn(),
    submit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <Calculator
        language="en"
        standalone
        targets={[{ label: "Use result", onUse: use }]}
      />
    </form>,
  );
  const input = screen.getByRole("textbox", {
    name: "Expression",
  }) as HTMLInputElement;
  return { input, use, submit };
}
const expression = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const result = () =>
  (
    screen.getByRole("textbox", {
      name: "Calculator result",
    }) as HTMLInputElement
  ).value;

it("calculates only learner-entered arithmetic and inserts the full result explicitly", () => {
  const { input, use, submit } = setup();
  expect(result()).toBe("");
  expression(input, "1/3");
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(result()).toBe("0.3333333333333333");
  expect(use).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use result" }));
  expect(use).toHaveBeenCalledWith("0.3333333333333333");
});

it("invalidates the result when expression or angle mode changes", () => {
  const { input, use } = setup();
  expression(input, "sin(30)");
  fireEvent.change(screen.getByLabelText("Angle unit"), {
    target: { value: "deg" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(Number(result())).toBeCloseTo(0.5, 12);
  fireEvent.change(screen.getByLabelText("Angle unit"), {
    target: { value: "rad" },
  });
  expect(result()).toBe("");
  expect(
    (screen.getByRole("button", { name: "Use result" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expression(input, "sqrt(-1)");
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(screen.getByRole("alert").textContent).toMatch(/domain|finite/i);
  expect(result()).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Use result" }));
  expect(use).not.toHaveBeenCalled();
});

it("supports touch keys, selected expressions, backspace and clearing", () => {
  const { input } = setup();
  fireEvent.click(screen.getByRole("button", { name: "7" }));
  fireEvent.click(screen.getByRole("button", { name: "×" }));
  fireEvent.click(screen.getByRole("button", { name: "4" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(result()).toBe("28");
  fireEvent.click(screen.getByRole("button", { name: "Clear calculator" }));
  expression(input, "9+16");
  input.setSelectionRange(0, 4);
  fireEvent.click(screen.getByRole("button", { name: "Square root" }));
  expect(input.value).toBe("sqrt(9+16)");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(result()).toBe("5");
  fireEvent.click(screen.getByRole("button", { name: "Clear calculator" }));
  expression(input, "12");
  input.setSelectionRange(2, 2);
  fireEvent.click(screen.getByRole("button", { name: "Backspace" }));
  expect(input.value).toBe("1");
});

it("offers a bilingual standalone tool with a blank expression", () => {
  render(<Calculator language="zh" standalone />);
  expect((screen.getByLabelText("算式") as HTMLInputElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("算式"), {
    target: { value: "log(100)" },
  });
  fireEvent.click(screen.getByRole("button", { name: "计算" }));
  expect((screen.getByLabelText("计算器结果") as HTMLInputElement).value).toBe(
    "2",
  );
  expect(screen.queryByRole("button", { name: /填入/ })).toBeNull();
});

it("continues arithmetic and functions from a result, then starts fresh for a new digit", () => {
  const { input } = setup();
  expression(input, "1+2");
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  fireEvent.click(screen.getByRole("button", { name: "×" }));
  fireEvent.click(screen.getByRole("button", { name: "3" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(result()).toBe("9");
  fireEvent.click(screen.getByRole("button", { name: "Square root" }));
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(result()).toBe("3");
  fireEvent.click(screen.getByRole("button", { name: "4" }));
  expect(input.value).toBe("4");
});

it("returns focus to the selected numeric destination and collapses the inline keypad", () => {
  render(
    <>
      <input id="first-answer" aria-label="First answer" />
      <input id="second-answer" aria-label="Second answer" />
      <Calculator
        language="en"
        targets={[
          { label: "Use first", targetId: "first-answer", onUse: () => {} },
          { label: "Use second", targetId: "second-answer", onUse: () => {} },
        ]}
      />
    </>,
  );
  fireEvent.click(screen.getByText("Calculator", { selector: "summary" }));
  fireEvent.change(screen.getByLabelText("Expression"), {
    target: { value: "6*7" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  fireEvent.click(screen.getByRole("button", { name: "Use second" }));
  expect(document.activeElement).toBe(screen.getByLabelText("Second answer"));
  expect(document.querySelector("details")?.open).toBe(false);
});
