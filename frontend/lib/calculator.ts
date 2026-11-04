// Calculator-only arithmetic. Keep this separate from the generated-model language:
// learner expressions never become JavaScript or change a lesson's accepted formulas.
export type AngleMode = "rad" | "deg";
export const CALCULATOR_MAX_LENGTH = 240;
export class CalculatorError extends Error {
  constructor(
    public readonly code: "syntax" | "domain" | "limit" | "multiplication",
  ) {
    super(code);
  }
}
const arities = {
  sqrt: 1,
  abs: 1,
  exp: 1,
  ln: 1,
  log: 1,
  log10: 1,
  sin: 1,
  cos: 1,
  tan: 1,
  min: 2,
  max: 2,
} as const;
const finite = (value: number) => {
  if (!Number.isFinite(value)) throw new CalculatorError("domain");
  return Object.is(value, -0) ? 0 : value;
};
function apply(name: keyof typeof arities, args: number[], mode: AngleMode) {
  const [a, b] = args;
  const angle = mode === "deg" ? a * (Math.PI / 180) : a;
  switch (name) {
    case "sqrt":
      return Math.sqrt(a);
    case "abs":
      return Math.abs(a);
    case "exp":
      return Math.exp(a);
    case "ln":
      return Math.log(a);
    case "log":
    case "log10":
      return Math.log10(a);
    case "sin":
      return Math.sin(angle);
    case "cos":
      return Math.cos(angle);
    case "tan":
      if (Math.abs(Math.cos(angle)) < 1e-14)
        throw new CalculatorError("domain");
      return Math.tan(angle);
    case "min":
      return Math.min(a, b);
    case "max":
      return Math.max(a, b);
  }
}

export function calculate(source: string, mode: AngleMode = "rad"): number {
  if (source.length > CALCULATOR_MAX_LENGTH) throw new CalculatorError("limit");
  const normalized = source
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/π/g, "pi");
  const tokens: (string | number)[] = [];
  let rest = normalized;
  while (rest.trim()) {
    const match =
      /^\s*(?:(\d+(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)|([a-z][a-z0-9]*)|([+*/^(),%-]))/i.exec(
        rest,
      );
    if (!match) throw new CalculatorError("syntax");
    tokens.push(
      match[1]
        ? finite(Number(match[1]))
        : (match[2]?.toLowerCase() ?? match[3]),
    );
    if (tokens.length > 128) throw new CalculatorError("limit");
    rest = rest.slice(match[0].length);
  }
  let at = 0;
  function parse(minimum = 0, depth = 0): number {
    if (depth > 32) throw new CalculatorError("limit");
    const token = tokens[at++];
    let value: number;
    if (typeof token === "number") value = token;
    else if (token === "+" || token === "-") {
      value = parse(25, depth + 1) * (token === "-" ? -1 : 1);
    } else if (token === "(") {
      value = parse(0, depth + 1);
      if (tokens[at++] !== ")") throw new CalculatorError("syntax");
    } else if (token === "pi" || token === "e") {
      value = token === "pi" ? Math.PI : Math.E;
    } else if (Object.hasOwn(arities, token)) {
      const name = token as keyof typeof arities;
      if (tokens[at++] !== "(") throw new CalculatorError("syntax");
      const args = [parse(0, depth + 1)];
      while (tokens[at] === ",") {
        at++;
        if (args.length >= arities[name]) throw new CalculatorError("syntax");
        args.push(parse(0, depth + 1));
      }
      if (tokens[at++] !== ")" || args.length !== arities[name])
        throw new CalculatorError("syntax");
      value = finite(apply(name, args, mode));
    } else throw new CalculatorError("syntax");
    while (at < tokens.length) {
      const op = tokens[at];
      if (op === "%" && minimum <= 40) {
        at++;
        value /= 100;
        continue;
      }
      const power =
        op === "+" || op === "-"
          ? 10
          : op === "*" || op === "/"
            ? 20
            : op === "^"
              ? 30
              : -1;
      if (power < minimum) {
        if (
          minimum === 0 &&
          (typeof op === "number" ||
            op === "(" ||
            op === "pi" ||
            op === "e" ||
            Object.hasOwn(arities, op))
        ) {
          throw new CalculatorError("multiplication");
        }
        break;
      }
      at++;
      const right = parse(op === "^" ? power : power + 1, depth + 1);
      value = finite(
        op === "+"
          ? value + right
          : op === "-"
            ? value - right
            : op === "*"
              ? value * right
              : op === "/"
                ? value / right
                : value ** right,
      );
    }
    return finite(value);
  }
  const result = parse();
  if (at !== tokens.length) throw new CalculatorError("syntax");
  return result;
}
