import { useEffect, useState } from "react";
import { say, type Access, type Language } from "../lib/types";
export function JudgeSession({
  access,
  language,
  working,
  onRestart,
}: {
  access: Access | null;
  language: Language;
  working: boolean;
  onRestart: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  const expiresAt = access?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  const seconds = Math.max(0, Math.ceil(((expiresAt ?? 0) - now) / 1000));
  const expired = seconds === 0;
  const canRestart = expired || (access?.remaining ?? 0) <= 0;
  const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section
      className="judge-session"
      aria-label={say(language, "Judge session", "评审会话")}
    >
      <div>
        <strong>{say(language, "Judge mode", "评审模式")}</strong>
        {expired ? (
          <span>
            {" "}
            ·{" "}
            {say(
              language,
              "This judge session has expired.",
              "本次评审会话已过期。",
            )}
          </span>
        ) : (
          access && (
            <span>
              {" "}
              · {access.remaining}/{access.quota}{" "}
              {say(language, "AI calls left", "次AI调用剩余")} · {remaining}{" "}
              {say(language, "remaining", "剩余时间")}
            </span>
          )
        )}
        <p className="fine">
          {say(
            language,
            expired
              ? "A new session uses a separate private workspace. Public lessons remain available."
              : canRestart
                ? "Export work before starting a new session. Each session has its own private workspace."
                : "Export work before this session expires. Each session has its own private workspace.",
            expired
              ? "新会话使用独立的私人工作区。公开课程仍可使用。"
              : canRestart
                ? "启动新会话前请导出作品。每个会话使用独立的私人工作区。"
                : "请在本次会话过期前导出作品。每个会话使用独立的私人工作区。",
          )}
        </p>
      </div>
      {canRestart && (
        <button className="secondary" onClick={onRestart} disabled={working}>
          {say(language, "New judge session", "新建评审会话")}
        </button>
      )}
    </section>
  );
}
