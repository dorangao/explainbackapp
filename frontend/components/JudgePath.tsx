import { t } from "../lib/messages";
import type { MessageKey } from "../lib/messages";
import type { Language } from "../lib/types";

export type JudgeStepId =
  "draft" | "tryout" | "show" | "illustrate" | "save" | "share";
export type JudgeStep = {
  id: JudgeStepId;
  // "done": the result is present (made now or reused from the cache).
  // "todo": one click runs it. "unavailable": this server lacks the model for it.
  state: "done" | "todo" | "unavailable";
  // Whether running it now would make a model request.
  request: boolean;
};
const labels: Record<JudgeStepId, { title: MessageKey; detail: MessageKey }> = {
  draft: { title: "JudgePath.draft", detail: "JudgePath.draftDetail" },
  tryout: { title: "JudgePath.tryout", detail: "JudgePath.tryoutDetail" },
  show: { title: "JudgePath.show", detail: "JudgePath.showDetail" },
  illustrate: {
    title: "JudgePath.illustrate",
    detail: "JudgePath.illustrateDetail",
  },
  save: { title: "JudgePath.save", detail: "JudgePath.saveDetail" },
  share: { title: "JudgePath.share", detail: "JudgePath.shareDetail" },
};
// The canonical six-step tour for a reviewer: draft, learner tryout, narrated show, one
// slide illustration, save, share. Each step reuses a cached result when its inputs are
// unchanged, so a second pass costs no requests; the panel says what each click costs.
export function JudgePath({
  language,
  steps,
  running,
  blocked = null,
  used,
  onRun,
  onRunAll,
}: {
  language: Language;
  steps: JudgeStep[];
  running: boolean;
  // Why no request can be made now: the provider session's cap or the hourly budget.
  blocked?: null | "session" | "hour";
  used: number;
  onRun: (id: JudgeStepId) => void;
  onRunAll: () => void;
}) {
  const canRun = blocked === null;
  // A step that makes no request (save, share) still runs when the budget is gone.
  const runnable = (s: JudgeStep) =>
    s.state === "todo" && (canRun || !s.request);
  const next = steps.find(runnable);
  const remaining = steps.filter((s) => s.state === "todo");
  const cost = remaining.filter((s) => s.request).length;
  const complete = steps.every((s) => s.state !== "todo");
  return (
    <section className="judge-path" aria-labelledby="judge-path-title">
      <div className="judge-head">
        <div>
          <p className="eyebrow">{t(language, "JudgePath.eyebrow")}</p>
          <h3 id="judge-path-title">{t(language, "JudgePath.title")}</h3>
          <p className="fine">{t(language, "JudgePath.intro")}</p>
        </div>
        <div className="judge-actions">
          <button
            type="button"
            disabled={running || !next}
            onClick={() => next && onRun(next.id)}
          >
            {running
              ? t(language, "JudgePath.running")
              : next
                ? `${t(language, "JudgePath.runNext")}: ${t(language, labels[next.id].title)}`
                : t(language, "JudgePath.allDone")}
          </button>
          {remaining.length > 1 && (
            <button
              type="button"
              className="secondary"
              disabled={running || !canRun}
              onClick={onRunAll}
            >
              {t(language, "JudgePath.runAll")} ({remaining.length})
            </button>
          )}
        </div>
      </div>
      <ol className="judge-steps">
        {steps.map((step, i) => (
          <li key={step.id} data-state={step.state}>
            <span className="judge-mark" aria-hidden="true">
              {step.state === "done" ? "✓" : String(i + 1)}
            </span>
            <div>
              <strong>{t(language, labels[step.id].title)}</strong>
              <small>{t(language, labels[step.id].detail)}</small>
            </div>
            <span className="judge-cost">
              {step.state === "done"
                ? t(language, "JudgePath.done")
                : step.state === "unavailable"
                  ? t(language, "JudgePath.unavailable")
                  : step.request
                    ? t(language, "JudgePath.oneRequest")
                    : t(language, "JudgePath.noRequest")}
            </span>
            {step.state === "todo" && (
              <button
                type="button"
                className="text-button"
                disabled={running || !runnable(step)}
                onClick={() => onRun(step.id)}
              >
                {t(language, "JudgePath.run")}
              </button>
            )}
          </li>
        ))}
      </ol>
      <p className="fine judge-foot" role="status">
        {complete
          ? t(language, "JudgePath.complete")
          : blocked === "hour"
            ? t(language, "JudgePath.noHourlyBudget")
            : blocked === "session"
              ? t(language, "JudgePath.noBudget")
              : `${t(language, "JudgePath.remainingCost")}: ${cost}`}
        {" · "}
        {t(language, "JudgePath.usedSoFar")}: {used}
      </p>
    </section>
  );
}
