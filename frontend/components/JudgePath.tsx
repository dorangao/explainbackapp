import { t } from "../lib/messages";
import type { MessageKey } from "../lib/messages";
import type { Language } from "../lib/types";

import type { JudgeStep, JudgeStepId } from "../lib/judge-path";
export type { JudgeStep, JudgeStepId } from "../lib/judge-path";
// `word` is the keyword on the bubble; `proves` names the competency a reviewer can take
// away from the step: what the app did that a plain model call would not, stated so it
// can be checked on screen.
const labels: Record<
  JudgeStepId,
  {
    word: MessageKey;
    title: MessageKey;
    detail: MessageKey;
    proves: MessageKey;
  }
> = {
  draft: {
    word: "JudgePath.draftWord",
    title: "JudgePath.draft",
    detail: "JudgePath.draftDetail",
    proves: "JudgePath.draftProves",
  },
  tryout: {
    word: "JudgePath.tryoutWord",
    title: "JudgePath.tryout",
    detail: "JudgePath.tryoutDetail",
    proves: "JudgePath.tryoutProves",
  },
  show: {
    word: "JudgePath.showWord",
    title: "JudgePath.show",
    detail: "JudgePath.showDetail",
    proves: "JudgePath.showProves",
  },
  illustrate: {
    word: "JudgePath.illustrateWord",
    title: "JudgePath.illustrate",
    detail: "JudgePath.illustrateDetail",
    proves: "JudgePath.illustrateProves",
  },
  save: {
    word: "JudgePath.saveWord",
    title: "JudgePath.save",
    detail: "JudgePath.saveDetail",
    proves: "JudgePath.saveProves",
  },
  share: {
    word: "JudgePath.shareWord",
    title: "JudgePath.share",
    detail: "JudgePath.shareDetail",
    proves: "JudgePath.shareProves",
  },
};
// The canonical six-step tour: draft, learner tryout, narrated show, one slide
// illustration, save, share. It sits above the Create form as a flow of bubbles: finished
// steps fill with a check, the current one is solid, and each carries a hint (its cost,
// Done, or a reminder to review the draft). Hovering a bubble shows what the step does
// and proves; a disclosure holds the same as cards with their Run buttons. Each step
// reuses a cached result when its inputs are unchanged, so a second pass costs nothing.
export function JudgePath({
  language,
  steps,
  running,
  blocked = null,
  used,
  reviewed = true,
  actions = true,
  onRun,
  onRunAll,
}: {
  language: Language;
  steps: JudgeStep[];
  running: boolean;
  // Why no request can be made now: the provider session's cap or the hourly budget.
  blocked?: null | "session" | "hour";
  used: number;
  // Whether the draft has been reviewed; until it has, the Draft bubble says so.
  reviewed?: boolean;
  // Visitors see the flow without the Run buttons and the request tally.
  actions?: boolean;
  onRun: (id: JudgeStepId) => void;
  onRunAll: () => void;
}) {
  const canRun = blocked === null;
  // A step that makes no request (save, share) still runs when the budget is gone.
  const runnable = (s: JudgeStep) =>
    s.state === "todo" && (canRun || !s.request);
  const next = steps.find(runnable);
  const current = steps.find((s) => s.state === "todo") ?? null;
  const remaining = steps.filter((s) => s.state === "todo");
  const cost = remaining.filter((s) => s.request).length;
  const complete = steps.every((s) => s.state !== "todo");
  const needsReview = (s: JudgeStep) =>
    s.id === "draft" && s.state === "done" && !reviewed;
  const costOf = (s: JudgeStep) =>
    s.state === "done"
      ? t(language, "JudgePath.done")
      : s.state === "unavailable"
        ? t(language, "JudgePath.unavailable")
        : s.request
          ? t(language, "JudgePath.oneRequest")
          : t(language, "JudgePath.noRequest");
  return (
    <section className="judge-path" aria-labelledby="judge-path-title">
      <div className="judge-head">
        <h3 id="judge-path-title">{t(language, "JudgePath.title")}</h3>
        {actions && (
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
        )}
      </div>
      <ol className="judge-steps">
        {steps.map((step, i) => (
          <li
            key={step.id}
            data-state={step.state}
            data-review={needsReview(step) || undefined}
            aria-current={current?.id === step.id ? "step" : undefined}
            className={
              step.state === "done"
                ? "is-complete"
                : current?.id === step.id
                  ? "is-current"
                  : ""
            }
          >
            <span className="flow-node" aria-hidden="true">
              {step.state === "done" ? "✓" : i + 1}
            </span>
            <span className="flow-text">
              <span className="flow-label">
                {t(language, labels[step.id].word)}
              </span>
              <small className="flow-hint">
                {needsReview(step)
                  ? t(language, "JudgePath.reviewTheDraft")
                  : costOf(step)}
              </small>
            </span>
            <span className="flow-tip" role="tooltip">
              <strong>{t(language, labels[step.id].title)}.</strong>{" "}
              {t(language, labels[step.id].detail)}{" "}
              <b>{t(language, "JudgePath.proves")}:</b>{" "}
              {t(language, labels[step.id].proves)}
            </span>
          </li>
        ))}
      </ol>
      {/* On a phone the bubbles carry numbers only; the current step's word and its
          hint, and the review reminder, sit under the row instead. */}
      {(current || steps.some(needsReview)) && (
        <p className="flow-current" aria-hidden="true">
          {current &&
            `${t(language, labels[current.id].word)} · ${costOf(current)}`}
          {steps.some(needsReview) && (
            <span className="flow-review">
              {t(language, "JudgePath.reviewTheDraft")}
            </span>
          )}
        </p>
      )}
      {actions && (
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
      )}
      <details className="judge-details">
        <summary>{t(language, "JudgePath.whatEachStepShows")}</summary>
        <ol className="judge-cards">
          {steps.map((step, i) => (
            <li key={step.id} data-state={step.state}>
              <strong>
                {i + 1} · {t(language, labels[step.id].title)}
              </strong>
              <small>{t(language, labels[step.id].detail)}</small>
              <small className="judge-proves">
                <b>{t(language, "JudgePath.proves")}:</b>{" "}
                {t(language, labels[step.id].proves)}
              </small>
              <span className="judge-cost">
                {needsReview(step)
                  ? `${costOf(step)} · ${t(language, "JudgePath.reviewTheDraft")}`
                  : costOf(step)}
              </span>
              {actions && step.state === "todo" && (
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
      </details>
    </section>
  );
}
