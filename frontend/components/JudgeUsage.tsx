import { useCallback, useEffect, useState } from "react";
import { getJson } from "../lib/api";
import { say, type Language } from "../lib/types";
type SessionUsage = {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: "active" | "expired" | "revoked";
  saves: number;
  calls: number;
  succeeded: number;
  failed: number;
  pending: number;
  inputTokens: number;
  outputTokens: number;
  reportedCalls: number;
  models: Record<string, number>;
  actions: Record<string, number>;
};
type Usage = {
  sessions: SessionUsage[];
  cursor: string | null;
  daily: { date: string; used: number; limit: number };
  retentionDays: number;
};
export function JudgeUsage({
  language,
  onClose,
}: {
  language: Language;
  onClose: () => void;
}) {
  const [usage, setUsage] = useState<Usage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async (cursor?: string) => {
    setBusy(true);
    setError("");
    try {
      const next = await getJson<Usage>(
        `/api/admin/judge-usage${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      setUsage((previous) => ({
        ...next,
        sessions:
          cursor && previous
            ? [
                ...previous.sessions,
                ...next.sessions.filter(
                  (row) => !previous.sessions.some((old) => old.id === row.id),
                ),
              ]
            : next.sessions,
      }));
    } catch {
      setError(
        "Could not load judge usage. Sign in as the administrator and retry.",
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const date = (value: number) =>
    new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  return (
    <section className="judge-usage" aria-labelledby="judge-usage-title">
      <div className="judge-usage-heading">
        <h2 id="judge-usage-title">
          {say(language, "Judge usage", "评审用量")}
        </h2>
        <div>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            {say(language, "Refresh usage", "刷新用量")}
          </button>
          <button className="text-button" onClick={onClose}>
            {say(language, "Close", "关闭")}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert">
          {say(language, error, "无法加载评审用量，请以管理员身份登录后重试。")}
        </p>
      )}
      {busy && (
        <p role="status">{say(language, "Loading usage…", "正在加载用量…")}</p>
      )}
      {usage && (
        <>
          <p>
            <strong>
              {usage.daily.used} / {usage.daily.limit}
            </strong>{" "}
            {say(language, "AI calls today", "今日AI调用")} · {usage.daily.date}{" "}
            UTC
          </p>
          <p className="fine">
            {say(
              language,
              `Sessions are retained for ${usage.retentionDays} days. Calls include failed attempts and retries; token totals include only usage returned by the provider.`,
              `保留${usage.retentionDays}天的会话记录。调用次数包含失败和重试；Token总数仅包含服务商返回的用量。`,
            )}
          </p>
          {usage.sessions.length === 0 ? (
            <p>{say(language, "No judge sessions yet.", "暂无评审会话。")}</p>
          ) : (
            <div className="judge-usage-table">
              <table>
                <thead>
                  <tr>
                    <th>{say(language, "Session", "会话")}</th>
                    <th>{say(language, "Started / expires", "开始 / 到期")}</th>
                    <th>{say(language, "State", "状态")}</th>
                    <th>{say(language, "Calls", "调用")}</th>
                    <th>{say(language, "Details", "详情")}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.sessions.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <code>{row.id}</code>
                      </td>
                      <td>
                        {date(row.createdAt)}
                        <br />
                        {date(row.expiresAt)}
                      </td>
                      <td>
                        {say(
                          language,
                          row.status,
                          {
                            active: "有效",
                            expired: "已到期",
                            revoked: "已撤销",
                          }[row.status],
                        )}
                      </td>
                      <td>{row.calls} / 50</td>
                      <td>
                        <details>
                          <summary>
                            {say(language, "Models and outcomes", "模型和结果")}
                          </summary>
                          <p>
                            {say(
                              language,
                              "Provider calls completed / failed / pending",
                              "服务商调用完成 / 失败 / 待完成",
                            )}
                            : {row.succeeded} / {row.failed} / {row.pending}
                          </p>
                          <ul>
                            {Object.entries(row.models).map(
                              ([model, calls]) => (
                                <li key={model}>
                                  {model}: {calls}
                                </li>
                              ),
                            )}
                          </ul>
                          <ul>
                            {Object.entries(row.actions).map(
                              ([action, calls]) => (
                                <li key={action}>
                                  {action.replace("/api/", "")}: {calls}
                                </li>
                              ),
                            )}
                          </ul>
                          <p>
                            {say(
                              language,
                              "Reported tokens: input / output",
                              "已报告Token：输入 / 输出",
                            )}
                            : {row.inputTokens.toLocaleString()} /{" "}
                            {row.outputTokens.toLocaleString()} (
                            {row.reportedCalls}{" "}
                            {say(language, "calls reported", "次调用报告")})
                          </p>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {usage.cursor && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void load(usage.cursor!)}
            >
              {say(language, "Load more sessions", "加载更多会话")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
