import { useEffect, useState } from "react";
import { say, type Access, type Language } from "../lib/types";
export function JudgeSession({
  access,
  language,
  working,
  onRestart,
}: {
  access: Access;
  language: Language;
  working: boolean;
  onRestart: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((access.expiresAt - now) / 1000));
  const remaining = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section
      className="judge-session"
      aria-label={say(language, "Judge session", "评审会话")}
    >
      <div>
        <strong>{say(language, "Judge mode", "评审模式")}</strong>
        <span>
          {" "}
          · {access.remaining}/{access.quota}{" "}
          {say(language, "AI calls left", "次AI调用剩余")} · {remaining}{" "}
          {say(language, "remaining", "剩余时间")}
        </span>
        <p className="fine">
          {say(
            language,
            "Export work before starting a new session. Each session has its own private workspace.",
            "启动新会话前请导出作品。每个会话使用独立的私人工作区。",
          )}
        </p>
      </div>
      <button className="secondary" onClick={onRestart} disabled={working}>
        {say(language, "New judge session", "新建评审会话")}
      </button>
    </section>
  );
}
