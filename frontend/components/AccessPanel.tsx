import { useState } from "react";
import { t } from "../lib/messages";
import type { AuthInfo, Language } from "../lib/types";
import { say } from "../lib/types";
export function AccessPanel({
  language,
  info,
  working,
  error,
  onLogin,
  onClose,
}: {
  language: Language;
  info: AuthInfo;
  working: boolean;
  error: string;
  onLogin: (body: unknown) => Promise<boolean>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const errors: Record<string, [string, string]> = {
    NETWORK: ["Could not connect. Please try again.", "无法连接，请重试。"],
    TESTER_CREDENTIALS: [
      "That username or password did not match.",
      "用户名或密码不匹配。",
    ],
    ACCESS_CODE: [
      "This code is invalid or has expired.",
      "访问码无效或已过期。",
    ],
    TESTER_REQUIRED: [
      "Your session ended. Sign in to continue creating.",
      "会话已结束，登录后继续创建。",
    ],
    TESTER_RATE: [
      "Too many attempts. Try again in a minute.",
      "尝试次数过多，请一分钟后重试。",
    ],
    TESTER_CAPACITY: [
      "Preview sessions are full. Please try again later.",
      "预览会话已满，请稍后重试。",
    ],
  };
  return (
    <section className="access-panel" aria-labelledby="access-title">
      <button
        className="text-button close-access"
        onClick={onClose}
        aria-label={t(language, "AccessPanel.closeSignIn")}
      >
        ×
      </button>
      <p className="eyebrow">{t(language, "AccessPanel.yourNextQuestion")}</p>
      <h2 id="access-title">{t(language, "AccessPanel.makeALessonOfYour")}</h2>
      <p>{t(language, "AccessPanel.creatingWithMuseNeedsPreview")}</p>
      {info.codes && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onLogin({ code: code.trim() })) setCode("");
          }}
        >
          <label htmlFor="reviewer-code">
            {t(language, "AccessPanel.reviewerAccessCode")}
          </label>
          <div className="code-row">
            <input
              id="reviewer-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={64}
              required
              disabled={working}
            />
            <button disabled={working}>
              {say(
                language,
                working ? "Signing in…" : "Open Studio →",
                working ? "正在登录…" : "进入工作室 →",
              )}
            </button>
          </div>
        </form>
      )}
      {info.configured && (
        <details className="account-details" open={!info.codes}>
          <summary>{t(language, "AccessPanel.signInWithATester")}</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await onLogin({ username, password });
              setPassword("");
              if (ok) setUsername("");
            }}
          >
            <label htmlFor="username">
              {t(language, "AccessPanel.username")}
            </label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              maxLength={80}
              required
              disabled={working}
            />
            <label htmlFor="password">
              {t(language, "AccessPanel.password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              maxLength={512}
              required
              disabled={working}
            />
            <button disabled={working}>
              {say(
                language,
                working ? "Signing in…" : "Sign in",
                working ? "正在登录…" : "登录",
              )}
            </button>
          </form>
        </details>
      )}
      {!info.codes && !info.configured && (
        <p className="notice">
          {t(language, "AccessPanel.creationAccessIsNotConfigured")}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {(errors[error] ?? errors.NETWORK)[language === "zh" ? 1 : 0]}
        </p>
      )}
      <p className="fine">
        {t(language, "AccessPanel.useSyntheticExamplesKeepPersonal")}
      </p>
    </section>
  );
}
