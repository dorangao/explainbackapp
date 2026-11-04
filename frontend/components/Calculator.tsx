import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  calculate,
  CALCULATOR_MAX_LENGTH,
  CalculatorError,
} from "../lib/calculator";
import type { AngleMode } from "../lib/calculator";
import type { Language } from "../lib/types";
import { say } from "../lib/types";

export function Calculator({
  language,
  standalone = false,
  disabled = false,
  targets = [],
  onInteraction,
}: {
  language: Language;
  standalone?: boolean;
  disabled?: boolean;
  targets?: {
    label: string;
    targetId?: string;
    onUse: (value: string) => void;
  }[];
  onInteraction?: () => void;
}) {
  const tr = (en: string, zh: string) => say(language, en, zh);
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    selection = useRef<number | null>(null),
    feedback = useRef<HTMLDivElement>(null);
  const [expression, setExpression] = useState(""),
    [mode, setMode] = useState<AngleMode>("rad");
  const [result, setResult] = useState<number | null>(null),
    [error, setError] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState("");
  const [evaluations, setEvaluations] = useState(0);
  useLayoutEffect(() => {
    if (evaluations > 0)
      feedback.current?.scrollIntoView?.({
        block: "nearest",
        behavior: "instant",
      });
  }, [evaluations]);
  useLayoutEffect(() => {
    if (selection.current === null) return;
    input.current?.setSelectionRange(selection.current, selection.current);
    selection.current = null;
  });
  const edit = (next: string) => {
    if (disabled) return;
    onInteraction?.();
    setExpression(next);
    setResult(null);
    setError(null);
    setCopyNote("");
  };
  const insert = (text: string) => {
    if (disabled) return;
    let before = expression,
      start = input.current?.selectionStart ?? before.length,
      end = input.current?.selectionEnd ?? start;
    // Continue from the calculated value, so 1+2, =, ×3 means (3)×3.
    if (result !== null && start === end) {
      if (/^[+−×÷^%]/.test(text)) {
        before = `(${result})`;
        start = end = before.length;
      } else if (text.endsWith("(")) {
        const next = `${text}${result})`;
        selection.current = next.length;
        edit(next);
        return;
      } else {
        before = "";
        start = end = 0;
      }
    }
    const selected = before.slice(start, end);
    let addition =
      selected && text.endsWith("(")
        ? text + selected + ")"
        : selected && text === "^2"
          ? `(${selected})^2`
          : text;
    const prefix = before.slice(0, start);
    const endsNamedValue = /(?:[)%π]|\bpi|\be)\s*$/i.test(prefix);
    // Match an entire numeric token, including scientific notation, rather than
    // mistaking the digits in a function name such as log10 for a number.
    const endsNumber =
      /(?:^|[^a-z0-9_])(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*$/i.test(prefix);
    if (
      ((endsNamedValue || endsNumber) && /^[a-zπ(]/i.test(addition)) ||
      (endsNamedValue && /^[\d.]/.test(addition))
    ) {
      addition = "×" + addition;
    }
    const next = before.slice(0, start) + addition + before.slice(end);
    if (next.length > CALCULATOR_MAX_LENGTH) return;
    selection.current = start + addition.length;
    edit(next);
  };
  const evaluate = () => {
    if (disabled) return;
    onInteraction?.();
    setCopyNote("");
    setEvaluations((count) => count + 1);
    try {
      setResult(calculate(expression, mode));
      setError(null);
    } catch (reason) {
      setResult(null);
      setError(reason instanceof CalculatorError ? reason.code : "syntax");
    }
  };
  const keys = [
    ["(", "("],
    [")", ")"],
    ["%", "%"],
    ["xʸ", "^"],
    ["7", "7"],
    ["8", "8"],
    ["9", "9"],
    ["÷", "÷"],
    ["4", "4"],
    ["5", "5"],
    ["6", "6"],
    ["×", "×"],
    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["−", "−"],
    ["0", "0"],
    [".", "."],
    ["π", "π"],
    ["+", "+"],
  ];
  const functions = [
    ["√", "sqrt(", tr("Square root", "平方根")],
    ["x²", "^2", tr("Square", "平方")],
    ["eˣ", "exp(", tr("Exponential", "指数函数")],
    ["e", "e", tr("Euler's number", "自然常数 e")],
    ["ln", "ln(", tr("Natural logarithm", "自然对数")],
    ["log₁₀", "log(", tr("Base 10 logarithm", "常用对数")],
    ["sin", "sin(", "sin"],
    ["cos", "cos(", "cos"],
    ["tan", "tan(", "tan"],
    ["abs", "abs(", tr("Absolute value", "绝对值")],
  ];
  const body = (
    <fieldset
      className="calculator-pad"
      disabled={disabled}
      aria-label={tr("Calculator", "计算器")}
    >
      <label htmlFor={`${id}-expression`}>{tr("Expression", "算式")}</label>
      <input
        ref={input}
        id={`${id}-expression`}
        className="calculator-expression"
        value={expression}
        maxLength={CALCULATOR_MAX_LENGTH}
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby={`${id}-help`}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            evaluate();
          }
        }}
      />
      <p id={`${id}-help`} className="fine calculator-help">
        {tr(
          "xʸ: powers such as 2^3. eˣ: exp(x). ln: natural log; log: base 10. %: divide by 100.",
          "xʸ 用于乘方，例如 2^3；eˣ 为 exp(x)。ln 为自然对数，log 为常用对数；% 表示除以 100。",
        )}
      </p>
      <div className="calculator-toolbar">
        <label>
          {tr("Angle unit", "角度单位")}
          <select
            value={mode}
            onChange={(event) => {
              onInteraction?.();
              setMode(event.target.value === "deg" ? "deg" : "rad");
              setResult(null);
              setError(null);
              setCopyNote("");
            }}
          >
            <option value="rad">{tr("Radians", "弧度")}</option>
            <option value="deg">{tr("Degrees", "角度")}</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          aria-label={tr("Clear calculator", "清空计算器")}
          onClick={() => edit("")}
        >
          C
        </button>
        <button
          type="button"
          className="secondary"
          aria-label={tr("Backspace", "退格")}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            const start = input.current?.selectionStart ?? expression.length,
              end = input.current?.selectionEnd ?? start;
            const from = start === end ? Math.max(0, start - 1) : start;
            selection.current = from;
            edit(expression.slice(0, from) + expression.slice(end));
          }}
        >
          ⌫
        </button>
      </div>
      <div className="calculator-functions">
        {functions.map(([label, value, name]) => (
          <button
            key={label}
            type="button"
            className="secondary"
            aria-label={name}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => insert(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="calculator-keys">
        {keys.map(([label, value]) => (
          <button
            key={label}
            type="button"
            className="secondary"
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => insert(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="calculator-equals"
        aria-label={tr("Calculate", "计算")}
        onClick={evaluate}
      >
        {tr("Calculate", "计算")} =
      </button>
      <div className="calculator-feedback" ref={feedback}>
        {error && (
          <p className="calculator-error" role="alert">
            {error === "multiplication"
              ? tr(
                  "Add × between a value and a function, e.g. 2 × exp(3). For a power, use xʸ (2^3).",
                  "数值与函数之间请加 ×，例如 2 × exp(3)。乘方请用 xʸ（2^3）。",
                )
              : error === "domain"
                ? tr(
                    "This calculation has no finite result in its domain. Check the values and angle unit.",
                    "此计算在定义域内没有有限结果，请检查数值和角度单位。",
                  )
                : error === "limit"
                  ? tr(
                      "This expression is too long or deeply nested. Split it into smaller calculations.",
                      "算式过长或嵌套过深，请分步计算。",
                    )
                  : tr(
                      "Check the expression, parentheses and function names.",
                      "请检查算式、括号和函数名称。",
                    )}
          </p>
        )}
        <label htmlFor={`${id}-result`}>{tr("Result", "结果")}</label>
        <input
          id={`${id}-result`}
          className="calculator-result"
          aria-label={tr("Calculator result", "计算器结果")}
          value={result === null ? "" : String(result)}
          readOnly
          onFocus={(event) => event.target.select()}
        />
        <p className="sr-only" aria-live="polite">
          {result === null ? "" : tr("Result: ", "结果：") + String(result)}
        </p>
        <div className="calculator-actions">
          {targets.map((target) => (
            <button
              key={target.label}
              type="button"
              disabled={disabled || result === null}
              onClick={() => {
                if (result === null || disabled) return;
                target.onUse(String(result));
                const disclosure = input.current?.closest("details");
                if (disclosure) disclosure.open = false;
                if (target.targetId)
                  document.getElementById(target.targetId)?.focus();
              }}
            >
              {target.label}
            </button>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={disabled || result === null}
            onClick={async () => {
              if (result === null) return;
              try {
                await navigator.clipboard.writeText(String(result));
                setCopyNote(tr("Copied.", "已复制。"));
              } catch {
                setCopyNote(
                  tr("Select the result to copy it.", "请选择结果后复制。"),
                );
              }
            }}
          >
            {tr("Copy result", "复制结果")}
          </button>
        </div>
        <p className="fine calculator-note" aria-live="polite">
          {copyNote ||
            tr(
              "Calculate in the answer's displayed units.",
              "请按答案所示单位计算。",
            )}
        </p>
      </div>
    </fieldset>
  );
  return standalone ? (
    body
  ) : (
    <details
      className="calculator"
      onToggle={(event) => {
        if (event.currentTarget.open) onInteraction?.();
      }}
    >
      <summary
        onClick={() => {
          if (
            !input.current?.closest("details")?.open &&
            document.activeElement instanceof HTMLInputElement
          )
            document.activeElement.blur();
        }}
      >
        {tr("Calculator", "计算器")}
      </summary>
      {body}
    </details>
  );
}

export function CalculatorDialog({
  language,
  open,
  onClose,
}: {
  language: Language;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    else if (!open && node?.open) node.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="calculator-dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
    >
      <div className="calculator-dialog-heading">
        <h2 id={`${id}-title`}>{say(language, "Calculator", "计算器")}</h2>
        <button
          type="button"
          className="text-button"
          autoFocus
          onClick={() => dialog.current?.close()}
        >
          {say(language, "Close calculator", "关闭计算器")}
        </button>
      </div>
      <Calculator language={language} standalone />
    </dialog>
  );
}
