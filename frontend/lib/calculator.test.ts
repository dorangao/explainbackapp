import { describe, expect, it } from "vitest";
import { calculate } from "./calculator";

describe("calculator arithmetic", () => {
  it.each([
    ["2 + 3 * 4", 14],
    ["(2 + 3) * 4", 20],
    ["2^3^2", 512],
    ["-2^2", -4],
    ["(-2)^2", 4],
    ["2^-3", 0.125],
    ["1e-3 + 2E+2", 200.001],
    [".5 + 5.", 5.5],
    ["6 × 4 ÷ 2 − 1", 11],
    ["200 * 15%", 30],
    ["50% + 25%", 0.75],
    ["sqrt(81) + abs(-4)", 13],
    ["ln(exp(2))", 2],
    ["log(1000) + log10(100)", 5],
    ["min(3, -2) + max(4, 8)", 6],
    ["cos(0) + sin(pi/2)", 2],
    ["sqrt(π^2)", Math.PI],
    ["exp(1)", Math.E],
    ["15+(90-15)*exp(-0.05*10)", 60.48979947844751],
    ["1e100 * 1e100", 1e200],
  ])("evaluates %s", (expression, expected) => {
    expect(calculate(expression)).toBeCloseTo(expected, 12);
  });

  it("uses explicit angle modes without changing logarithms", () => {
    expect(calculate("sin(30)+cos(60)+tan(45)", "deg")).toBeCloseTo(2, 12);
    expect(calculate("sin(pi/6)", "rad")).toBeCloseTo(0.5, 12);
    expect(calculate("ln(e)", "deg")).toBe(1);
  });

  it.each([
    "",
    "2+",
    "(2+3",
    "2 3",
    "2pi",
    "unknown(1)",
    "sqrt(1,2)",
    "min(1)",
    "1,2",
    "2**3",
    "Math.sqrt(4)",
    "globalThis.alert(1)",
    "constructor(1)",
    "__proto__",
    "[1]",
    "1;2",
    "0x10",
    "NaN",
    "Infinity",
  ])("rejects incomplete or unsupported syntax %j", (expression) => {
    expect(() => calculate(expression)).toThrow();
  });

  it.each([
    "1/0",
    "0/0",
    "sqrt(-1)",
    "ln(0)",
    "log(-1)",
    "(-1)^.5",
    "exp(1000)",
    "1e999",
  ])("rejects invalid domains and non-finite results %s", (expression) =>
    expect(() => calculate(expression)).toThrow(),
  );

  it("rejects undefined tangent values in both modes", () => {
    expect(() => calculate("tan(90)", "deg")).toThrow();
    expect(() => calculate("tan(pi/2)")).toThrow();
  });

  it("bounds expression length and nesting", () => {
    expect(() => calculate("1+".repeat(300) + "1")).toThrow();
    expect(() => calculate("(".repeat(40) + "1" + ")".repeat(40))).toThrow();
  });
});
