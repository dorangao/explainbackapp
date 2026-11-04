import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, postJson } from "../lib/api";
import { say, type Language } from "../lib/types";
type Check = { id: string; expiresAt: number } & (
  | { kind: "image"; image: string }
  | { kind: "text"; left: number; right: number }
);
export function JudgeCheck({
  language,
  working,
  cooldown,
  onLogin,
}: {
  language: Language;
  working: boolean;
  cooldown: boolean;
  onLogin: (body: unknown) => Promise<boolean>;
}) {
  const [check, setCheck] = useState<Check | null>(null),
    [answer, setAnswer] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const version = useRef(0),
    form = useRef<HTMLFormElement>(null),
    answerInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async (kind: "image" | "text" = "image") => {
    // Keep focus in this check while its input is replaced and buttons disable.
    if (form.current?.contains(document.activeElement))
      form.current.focus({ preventScroll: true });
    const token = ++version.current;
    setBusy(true);
    setError("");
    setCheck(null);
    setAnswer("");
    try {
      const next = await postJson<Check>("/api/judge-challenge", { kind });
      if (token === version.current) setCheck(next);
    } catch (e) {
      if (token === version.current)
        setError(
          e instanceof ApiError && e.status === 429 ? "rate" : "network",
        );
    } finally {
      if (token === version.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    const versionRef = version;
    void load();
    return () => {
      versionRef.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!check) return;
    const timer = window.setTimeout(
      () => {
        setCheck(null);
        setAnswer("");
        setError("expired");
      },
      Math.max(0, check.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [check]);
  useEffect(() => {
    // The entry can focus this form while the check loads. Hand focus to its
    // answer once ready, unless the visitor has moved to another sign-in field.
    if (check && !busy && form.current?.contains(document.activeElement))
      answerInput.current?.focus({ preventScroll: true });
  }, [check, busy]);
  return (
    <form
      ref={form}
      tabIndex={-1}
      className="judge-check"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!check || busy || working || cooldown) return;
        const success = await onLogin({
          judge: true,
          challengeId: check.id,
          answer: answer.trim(),
        });
        if (!success) {
          setCheck(null);
          setAnswer("");
        }
      }}
    >
      <p>
        <strong>
          {say(language, "A quick check before you begin", "开始前的小验证")}
        </strong>
      </p>
      {check?.kind === "image" && (
        <img
          width="240"
          height="88"
          src={check.image}
          alt={say(
            language,
            "Five-digit verification image. Use the text check if needed.",
            "五位数字验证图。如有需要，可改用文字验证。",
          )}
        />
      )}
      {check?.kind === "text" && (
        <p className="judge-check-question">
          {say(
            language,
            `What is ${check.left} + ${check.right}?`,
            `请计算 ${check.left} + ${check.right}。`,
          )}
        </p>
      )}
      {busy && (
        <p role="status">
          {say(language, "Preparing a quick check…", "正在准备验证…")}
        </p>
      )}
      {error && (
        <p role="status">
          {say(
            language,
            error === "rate"
              ? "Too many checks requested. Please wait before requesting another check."
              : error === "expired"
                ? "This check expired. Request a new one."
                : "Could not load the check. Please try again.",
            error === "rate"
              ? "验证请求过于频繁，请稍候再获取新的验证。"
              : error === "expired"
                ? "验证已过期，请获取新的验证。"
                : "无法加载验证，请重试。",
          )}
        </p>
      )}
      {check && (
        <label>
          {say(
            language,
            check.kind === "image" ? "Enter the five digits" : "Your answer",
            check.kind === "image" ? "输入图中的五位数字" : "你的答案",
          )}
          <input
            ref={answerInput}
            value={answer}
            onChange={(e) => setAnswer(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            required
            disabled={busy || working}
          />
        </label>
      )}
      <div className="judge-check-actions">
        <button
          type="button"
          className="text-button"
          disabled={busy || working || cooldown}
          onClick={() => void load("image")}
        >
          {say(language, "New image", "换一张图片")}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy || working || cooldown}
          onClick={() => void load("text")}
        >
          {say(language, "Use a text check", "改用文字验证")}
        </button>
      </div>
      <button
        type="submit"
        disabled={busy || working || cooldown || !check || !answer.trim()}
      >
        {say(
          language,
          working ? "Starting…" : "Start Judge mode",
          working ? "正在启动…" : "启动评审模式",
        )}
      </button>
      {!check && !busy && !error && (
        <p role="status">
          {say(
            language,
            "Request a new check to try again.",
            "请获取新的验证后重试。",
          )}
        </p>
      )}
    </form>
  );
}
