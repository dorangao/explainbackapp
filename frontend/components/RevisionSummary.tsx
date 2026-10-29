import { useMemo, useState } from "react";
import { t } from "../lib/messages";
import type { Language, Lesson } from "../lib/types";
import { say } from "../lib/types";
import { lessonChanges } from "../lib/lesson-diff";
import type { RequestMetrics } from "../hooks/useProviderSession";
import { RequestSummary } from "./RequestSummary";

// Shows what an explicit revision changed, field by field, so the model's
// contribution is visible and reviewable. Pure comparison; no judgement of correctness.
export function RevisionSummary({
  before,
  after,
  language,
  metrics,
  onDismiss,
  onRestore,
}: {
  before: Lesson;
  after: Lesson;
  language: Language;
  metrics: RequestMetrics | null;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const changes = useMemo(
    () => lessonChanges(before, after, language),
    [before, after, language],
  );
  const visible = showAll ? changes : changes.slice(0, 8);
  return (
    <section
      className="revision-summary"
      aria-labelledby="revision-summary-title"
    >
      <div className="revision-summary-head">
        <div>
          <p className="eyebrow">
            {t(language, "RevisionSummary.whatMuseChanged")}
          </p>
          <h2 id="revision-summary-title">
            {changes.length === 0
              ? t(language, "RevisionSummary.noVisibleChangeInThis")
              : `${changes.length} ${say(language, changes.length === 1 ? "field changed" : "fields changed", "处修改")}`}
          </h2>
          <RequestSummary metrics={metrics} language={language} />
        </div>
        <div className="revision-actions">
          <button type="button" className="secondary" onClick={onRestore}>
            {t(language, "RevisionSummary.restorePreviousDraft")}
          </button>
          <button type="button" className="text-button" onClick={onDismiss}>
            {t(language, "RevisionSummary.dismiss")}
          </button>
        </div>
      </div>
      {changes.length > 0 && (
        <ul className="revision-changes">
          {visible.map((change) => (
            <li key={change.path} data-kind={change.kind}>
              <span className="revision-label">{change.label[language]}</span>
              <span className="revision-values">
                {change.kind !== "added" && <del>{change.before}</del>}
                {change.kind !== "removed" && <ins>{change.after}</ins>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {changes.length > visible.length && (
        <button
          type="button"
          className="text-button"
          onClick={() => setShowAll(true)}
        >
          {t(language, "RevisionSummary.showAllChanges")} ({changes.length})
        </button>
      )}
      <p className="fine">
        {t(language, "RevisionSummary.comparedFieldByFieldIn")}
      </p>
    </section>
  );
}
