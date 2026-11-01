import { useId, useState } from "react";
import { t } from "../lib/messages";
import type { JudgeReply, Language } from "../lib/types";
import { evaluationModelLabel } from "../lib/shared";

// Check figures against the web, from the lesson's own page: the grounded rubric judge
// reads the lesson, searches for every figure it names and reports any that disagree with
// current pages. One request; the lesson is unchanged, and the result is one model's
// opinion with its citations.
export function FigureCheck({
  language,
  busy,
  working = false,
  onCheck,
}: {
  language: Language;
  // Disabled while any Muse request runs; the checking wording only while this one does.
  busy: boolean;
  working?: boolean;
  onCheck: () => Promise<JudgeReply | null>;
}) {
  const headingId = useId();
  const [result, setResult] = useState<JudgeReply | null>(null);
  const judge = result?.judge ?? null;
  const currency = judge?.scores.factualCurrency;
  return (
    <section className="figure-check" aria-labelledby={headingId}>
      <p className="eyebrow">{t(language, "Figures.eyebrow")}</p>
      <h3 id={headingId}>{t(language, "Figures.title")}</h3>
      <p className="fine">{t(language, "Figures.note")}</p>
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={() =>
          void onCheck().then((reply) => {
            if (reply) setResult(reply);
          })
        }
      >
        {working
          ? t(language, "Figures.checking")
          : t(language, result ? "Figures.checkAgain" : "Figures.check")}
      </button>
      {judge && (
        <div className="figure-result" role="status">
          <p className="figure-score">
            {currency !== undefined && (
              <>
                <strong>{t(language, "Compare.factualCurrency")}</strong>{" "}
                {currency}/2 ·{" "}
              </>
            )}
            {t(language, "Compare.wordingRubric")} {judge.total}/{judge.max} ·{" "}
            {evaluationModelLabel(judge.model)}
            {judge.pagesRead !== undefined &&
              ` · ${
                judge.pagesRead === 1
                  ? t(language, "Figures.pageRead")
                  : t(language, "Figures.pagesRead").replace(
                      "{n}",
                      String(judge.pagesRead),
                    )
              }`}
          </p>
          {judge.factualIssues && (
            <>
              <h4>{t(language, "Compare.figuresTheJudgeDisputed")}</h4>
              {judge.factualIssues.length > 0 ? (
                <ul className="compare-issues compare-figures">
                  {judge.factualIssues.map((issue, index) => (
                    <li key={index}>
                      <q>{issue.claim}</q> {issue.finding}
                      {issue.url && (
                        <>
                          {" "}
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t(language, "Compare.source")}
                          </a>
                          {!issue.verified &&
                            ` (${t(language, "Compare.notInTheSearchResults")})`}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fine">
                  {t(language, "Compare.noFiguresDisputed")}
                </p>
              )}
            </>
          )}
          {judge.issues.length > 0 && (
            <>
              <h4>{t(language, "Compare.issuesTheJudgeRaised")}</h4>
              <ul className="compare-issues">
                {judge.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </>
          )}
          <p className="fine">{judge.summary}</p>
          <p className="fine">{t(language, "Compare.groundedNote")}</p>
        </div>
      )}
    </section>
  );
}
