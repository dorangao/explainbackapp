import { useEffect, useState } from "react";
import { t } from "../lib/messages";
import type { AuthInfo, Language } from "../lib/types";
import { say } from "../lib/types";
export function AccessPanel({
  language,
  info,
  working,
  error,
  retryAt,
  onLogin,
  onClose,
}: {
  language: Language;
  info: AuthInfo;
  working: boolean;
  error: string;
  retryAt?: number;
  onLogin: (body: unknown) => Promise<boolean>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState("");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!retryAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= retryAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  const wait = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  const retryMessage: [string, string] = retryAt
    ? wait > 0
      ? [`Try again in ${wait} seconds.`, `请在${wait}秒后重试。`]
      : ["You can try again now.", "现在可以重试。"]
    : ["Please try again shortly.", "请稍后重试。"];
  const errors: Record<string, [string, string]> = {
    JUDGE_START_LIMIT: [
      `Too many judge sessions started. ${retryMessage[0]} Your current session, if any, is unchanged.`,
      `评审会话启动次数过多。${retryMessage[1]}已有会话不受影响。`,
    ],
    API_RATE_LIMIT: [
      `Too many requests from this network. ${retryMessage[0]} Your current session, if any, is unchanged.`,
      `此网络的请求过于频繁。${retryMessage[1]}已有会话不受影响。`,
    ],
    JUDGE_DISABLED: [
      "Judge mode is currently unavailable.",
      "评审模式暂不可用。",
    ],
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
      {info.judgeMode ? (
        <div className="judge-access">
          <h3>
            {say(
              language,
              "Try ExplainBack as a judge",
              "以评审身份体验 ExplainBack",
            )}
          </h3>
          <p>
            {say(
              language,
              "No account or invite code needed. Each session lasts 30 minutes and includes up to 50 AI calls, subject to a shared daily allowance. One action may use several calls.",
              "无需账号或邀请码。每个会话有效期为30分钟，最多可调用AI 50次，并受共享每日额度限制。一次操作可能调用多次。",
            )}
          </p>
          <button
            disabled={working || wait > 0}
            onClick={() => void onLogin({ judge: true })}
          >
            {say(
              language,
              working ? "Starting…" : "Start Judge mode",
              working ? "正在启动…" : "启动评审模式",
            )}
          </button>
          <p className="fine">
            {say(
              language,
              "A new session starts with an empty private workspace. Export work before restarting. Session usage is visible to the app administrator.",
              "新会话使用独立的私人工作区。重新启动前请导出作品。应用管理员可以查看会话用量。",
            )}
          </p>
        </div>
      ) : (
        <p>{t(language, "AccessPanel.creatingWithMuseNeedsPreview")}</p>
      )}
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
        <details
          className="account-details"
          open={!info.codes && !info.judgeMode}
        >
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
      {!info.judgeMode && !info.codes && !info.configured && (
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
