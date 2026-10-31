import { useId } from "react";
import { t } from "../lib/messages";
import type { MessageKey } from "../lib/messages";
import {
  evaluationComparison,
  evaluationLesson,
  evaluationModelLabel,
  evaluationNote,
} from "../lib/shared";
import type { EvaluationItem, Language } from "../lib/types";
import { EVALUATION_CARD_URL, RUBRIC_ITEMS } from "../lib/evaluation";
import type { RubricItem } from "../lib/evaluation";
import { kindLabel } from "./Library";

const rubricKey: Record<RubricItem, MessageKey> = {
  neutralFraming: "Compare.neutralFraming",
  quantityNames: "Compare.quantityNames",
  transferClarity: "Compare.transferClarity",
  bilingualParity: "Compare.bilingualParity",
  assumptions: "Compare.assumptions",
};
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// One model's reply to the shared question: the lesson's contract in brief, then the judge's view.
function ModelColumn({
  language,
  item,
}: {
  language: Language;
  item: EvaluationItem;
}) {
  const demo = item.lesson.chapters[0].demo;
  const headingId = useId();
  return (
    <section className="compare-column" aria-labelledby={headingId}>
      <header className="compare-head">
        <span className="lesson-badge lesson-badge-model">
          {evaluationModelLabel(item.model)}
        </span>
        <span className="fine">{item.model}</span>
        <h3 id={headingId}>{item.lesson.title[language]}</h3>
        <p className="lesson-kind">{kindLabel(language, item.kind)}</p>
      </header>
      <p className="compare-intro">{item.lesson.intro[language]}</p>
      {demo && (
        <>
          <h4>{t(language, "Compare.claim")}</h4>
          <p>{demo.claim[language]}</p>
          {demo.kind === "model" ? (
            <>
              <h4>{t(language, "Compare.inputs")}</h4>
              <ul className="compare-list">
                {demo.inputs.map((input) => (
                  <li key={input.id}>
                    {input.label[language]}
                    <span className="fine">
                      {" "}
                      {input.min}–{input.max} {input.unit}
                    </span>
                  </li>
                ))}
              </ul>
              <h4>{t(language, "Compare.outputs")}</h4>
              <ul className="compare-list">
                {demo.outputs.map((output) => (
                  <li key={output.id}>
                    {output.label[language]}
                    {output.unit && output.unit !== "1" && (
                      <span className="fine"> ({output.unit})</span>
                    )}
                    <code className="compare-expression">
                      {output.expression}
                    </code>
                  </li>
                ))}
              </ul>
              <p className="fine">
                {t(language, "Compare.axis")}: {demo.axis.label[language]}{" "}
                {demo.axis.min}–{demo.axis.max} {demo.axis.unit}
              </p>
            </>
          ) : (
            <>
              <h4>
                {t(language, "Compare.stages")} ({demo.stages.length})
              </h4>
              <ol className="compare-list">
                {demo.stages.map((stage, index) => (
                  <li key={index}>{stage.title[language]}</li>
                ))}
              </ol>
            </>
          )}
          <h4>{t(language, "Compare.transferQuestion")}</h4>
          <p>{demo.transfer.question[language]}</p>
        </>
      )}
      <div className="compare-judge">
        <h4>
          {t(language, "Compare.judge")} · {item.judge.total}/{item.judge.max}
        </h4>
        <dl className="compare-scores">
          {RUBRIC_ITEMS.map((key) => (
            <div key={key}>
              <dt>{t(language, rubricKey[key])}</dt>
              <dd aria-label={`${item.judge.scores[key] ?? 0} / 2`}>
                <span
                  className={`score-dots score-${item.judge.scores[key] ?? 0}`}
                  aria-hidden="true"
                />
                {item.judge.scores[key] ?? 0}/2
              </dd>
            </div>
          ))}
        </dl>
        {item.judge.issues.length > 0 ? (
          <>
            <h5>{t(language, "Compare.issuesTheJudgeRaised")}</h5>
            <ul className="compare-issues">
              {item.judge.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="fine">{t(language, "Gallery.noIssuesRaised")}</p>
        )}
        <p className="fine compare-judge-summary">{item.judge.summary}</p>
      </div>
      <p className="fine compare-cost">
        {t(language, "Compare.latency")} {seconds(item.latencyMs)}
        {item.tokens.input !== null && item.tokens.output !== null && (
          <>
            {" · "}
            {t(language, "Compare.tokens")} {item.tokens.input}/
            {item.tokens.output}
          </>
        )}
      </p>
      <a
        className="lesson-link"
        href={`#lesson:${item.id}`}
        aria-label={`${t(language, "Gallery.openLesson")}: ${item.lesson.title[language]}`}
      >
        {t(language, "Gallery.openLesson")} <span aria-hidden="true">↗</span>
      </a>
      <details className="lesson-source">
        <summary>{t(language, "Gallery.aboutThisLesson")}</summary>
        <p>{evaluationNote(item, language)}</p>
      </details>
    </section>
  );
}

export function Comparison({
  caseId,
  language,
}: {
  caseId: string;
  language: Language;
}) {
  const comparison = evaluationComparison(caseId);
  const items = comparison
    ? comparison.ids
        .map((id) => evaluationLesson(id))
        .filter((item): item is EvaluationItem => item !== null)
    : [];
  const headingId = useId();
  if (!comparison || items.length !== 2) return null;
  const [first] = items;
  return (
    <section className="comparison" aria-labelledby={headingId}>
      <div className="section-title">
        <div>
          <p className="eyebrow">
            {t(language, "Compare.sameQuestionTwoModels")}
          </p>
          <h2 id={headingId}>{first.question[language]}</h2>
          <p className="fine">
            {t(language, "Compare.note")} {first.suite} · {first.caseId} ·{" "}
            <a href={EVALUATION_CARD_URL} target="_blank" rel="noreferrer">
              {t(language, "Gallery.evaluationCard")}
            </a>
          </p>
        </div>
        <a className="text-link" href="#studio">
          {t(language, "LessonPlayer.backToLibrary")}
        </a>
      </div>
      <div className="compare-grid">
        {items.map((item) => (
          <ModelColumn key={item.id} language={language} item={item} />
        ))}
      </div>
      <p className="gallery-footnote">{t(language, "Compare.footnote")}</p>
    </section>
  );
}
