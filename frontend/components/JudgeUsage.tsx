import { useCallback, useEffect, useState } from "react";
import { getJson } from "../lib/api";
import { say, type Language, type Post } from "../lib/types";
type SessionUsage = {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: "active" | "expired" | "revoked";
  saves: number;
  calls: number;
  used?: number;
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
  daily: { date: string; used: number; limit: number; total?: number };
  resets?: {
    type: string;
    at: number;
    reason: string;
    previousUsed: number;
    sessionId?: string;
  }[];
  retentionDays: number;
};
export function JudgeUsage({
  language,
  onClose,
  post,
}: {
  language: Language;
  onClose: () => void;
  post: Post;
}) {
  const [usage, setUsage] = useState<Usage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reset, setReset] = useState<{
      type: "starts" | "daily" | "session";
      sessionId?: string;
    } | null>(null),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const prepareReset = (next: NonNullable<typeof reset>) => {
    setReset(next);
    setReason("");
    setConfirmed(false);
  };
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
              `Total provider calls today: ${usage.daily.total ?? usage.daily.used}. The allowance above counts calls since the last manual reset.`,
              `今日实际调用总数：${usage.daily.total ?? usage.daily.used}。上方额度显示上次手动重置后的调用次数。`,
            )}
          </p>
          <div className="judge-reset-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => prepareReset({ type: "starts" })}
            >
              {say(language, "Reset start cooldowns", "重置启动冷却")}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => prepareReset({ type: "daily" })}
            >
              {say(language, "Reset daily allowance", "重置每日额度")}
            </button>
          </div>
          {reset && (
            <form
              className="judge-reset-confirm"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!confirmed || reason.trim().length < 3 || busy) return;
                setBusy(true);
                setError("");
                try {
                  await post("/api/admin/judge-reset", {
                    ...reset,
                    reason: reason.trim(),
                    confirm: true,
                  });
                  setReset(null);
                  await load();
                } catch {
                  setError(
                    "Reset failed. Refresh usage and check administrator access before retrying.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>
                {say(language, "Confirm Judge reset", "确认重置评审额度")}
              </h3>
              <p>
                {say(
                  language,
                  reset.type === "daily"
                    ? "Restore up to 500 more Judge calls for everyone today. This can increase model costs."
                    : reset.type === "session"
                      ? `Restore up to 50 more calls for session ${reset.sessionId}. Its expiry will not change.`
                      : "Clear this network’s Judge start/check cooldowns and the shared start/check cooldowns. Other networks’ individual cooldowns and Vercel firewall limits remain in place.",
                  reset.type === "daily"
                    ? "为所有评审恢复今日最多500次调用。这可能增加模型费用。"
                    : reset.type === "session"
                      ? `为会话 ${reset.sessionId} 恢复最多50次调用。到期时间不变。`
                      : "清除此网络和全局的评审启动及验证冷却。其他网络的独立冷却和Vercel防火墙限制仍然有效。",
                )}
              </p>
              <p>
                {say(
                  language,
                  "Usage history stays intact. This action is recorded in the reset history.",
                  "用量历史不会被删除。此操作将记录在重置历史中。",
                )}
              </p>
              <label>
                {say(language, "Reason for reset", "重置原因")}
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy}
                />
                {say(language, "I confirm this reset", "我确认执行此重置")}
              </label>
              <button disabled={busy || !confirmed || reason.trim().length < 3}>
                {say(language, "Confirm reset", "确认重置")}
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => setReset(null)}
              >
                {say(language, "Cancel", "取消")}
              </button>
            </form>
          )}
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
                      <td>
                        {row.used ?? row.calls} / 50
                        {row.used !== undefined && row.used !== row.calls && (
                          <p className="fine">
                            {row.calls}{" "}
                            {say(language, "total calls", "次总调用")}
                          </p>
                        )}
                      </td>
                      <td>
                        {row.status === "active" && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              prepareReset({
                                type: "session",
                                sessionId: row.id,
                              })
                            }
                          >
                            {say(
                              language,
                              "Reset session allowance",
                              "重置会话额度",
                            )}
                          </button>
                        )}
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
          {!!usage.resets?.length && (
            <details className="judge-reset-history">
              <summary>
                {say(language, "Administrator reset history", "管理员重置历史")}
              </summary>
              <ul>
                {usage.resets.map((event, i) => (
                  <li key={`${event.at}-${i}`}>
                    {date(event.at)} · {event.type}
                    {event.sessionId ? ` · ${event.sessionId}` : ""} ·{" "}
                    {say(language, "previous usage", "重置前用量")}{" "}
                    {event.previousUsed} · {event.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
