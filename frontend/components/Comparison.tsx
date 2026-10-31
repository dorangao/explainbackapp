import { useId } from "react";
import type { ReactNode } from "react";
import { t } from "../lib/messages";
import type { MessageKey } from "../lib/messages";
import {
  evaluationComparison,
  evaluationLesson,
  evaluationModelLabel,
  evaluationNote,
} from "../lib/shared";
import type {
  Bilingual,
  CompareDraft,
  CompareReply,
  EvaluationItem,
  Language,
  Lesson,
} from "../lib/types";
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

// What one column needs, whether the reply comes from the frozen showcase or from a live
// request in Studio: the model, the lesson (none when declined, rejected or failed), the
// judge's view and the cost.
export type CompareColumnItem = {
  id: string;
  model: string;
  status: "ready" | "unsupported" | "rejected" | "failed";
  checksPassed: boolean;
  lesson: Lesson | null;
  kind: "model" | "process" | null;
  message?: Bilingual;
  reason?: string;
  judge: EvaluationItem["judge"] | null;
  judgeSkipped?: string;
  latencyMs: number;
  tokens: { input: number | null; output: number | null } | null;
  note?: string;
};
export const columnFromEvaluation = (
  item: EvaluationItem,
  language: Language,
): CompareColumnItem => ({
  id: item.id,
  model: item.model,
  status: "ready",
  checksPassed: true,
  lesson: item.lesson,
  kind: item.kind,
  judge: item.judge,
  latencyMs: item.latencyMs,
  tokens: item.tokens,
  note: evaluationNote(item, language),
});
export const columnFromDraft = (
  draft: CompareDraft,
  index: number,
): CompareColumnItem => ({
  id: `live-${index}-${draft.model}`,
  model: draft.model,
  status: draft.status,
  checksPassed: draft.automatedPass,
  lesson: draft.lesson,
  kind: draft.kind,
  message: draft.message,
  reason: draft.reason,
  judge: draft.judge && "total" in draft.judge ? draft.judge : null,
  judgeSkipped:
    draft.judge && "failure" in draft.judge ? draft.judge.failure : undefined,
  latencyMs: draft.elapsedMs,
  tokens: draft.usage ?? null,
});

function StatusBadge({
  language,
  item,
}: {
  language: Language;
  item: CompareColumnItem;
}) {
  const state =
    item.status === "ready"
      ? item.checksPassed
        ? "ready"
        : "checks-failed"
      : item.status;
  const label: MessageKey =
    state === "ready"
      ? "Compare.checksPassed"
      : state === "checks-failed"
        ? "Compare.checksFailed"
        : state === "unsupported"
          ? "Compare.declined"
          : state === "rejected"
            ? "Compare.rejected"
            : "Compare.failed";
  return (
    <span className="compare-status" data-state={state}>
      {t(language, label)}
    </span>
  );
}

// One model's reply to the shared question: the lesson's contract in brief, then the judge's view.
export function ModelColumn({
  language,
  item,
  action,
  openHref,
}: {
  language: Language;
  item: CompareColumnItem;
  action?: ReactNode;
  openHref?: string;
}) {
  const demo = item.lesson?.chapters[0].demo;
  const headingId = useId();
  const title = item.lesson?.title[language] ?? item.model;
  const judge = item.judge;
  return (
    <section className="compare-column" aria-labelledby={headingId}>
      <header className="compare-head">
        <span className="lesson-badge lesson-badge-model">
          {evaluationModelLabel(item.model)}
        </span>
        <span className="fine">{item.model}</span>
        <h3 id={headingId}>{title}</h3>
        {item.kind && (
          <p className="lesson-kind">{kindLabel(language, item.kind)}</p>
        )}
      </header>
      <StatusBadge language={language} item={item} />
      {item.status !== "ready" && (
        <p className="compare-reason">
          {item.status === "unsupported"
            ? (item.message?.[language] ?? "")
            : (item.reason ?? "")}
        </p>
      )}
      {item.lesson && (
        <p className="compare-intro">{item.lesson.intro[language]}</p>
      )}
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
      {judge ? (
        <div className="compare-judge">
          <h4>
            {t(language, "Compare.judge")} · {judge.total}/{judge.max}
          </h4>
          <dl className="compare-scores">
            {RUBRIC_ITEMS.map((key) => (
              <div key={key}>
                <dt>{t(language, rubricKey[key])}</dt>
                <dd aria-label={`${judge.scores[key] ?? 0} / 2`}>
                  <span
                    className={`score-dots score-${judge.scores[key] ?? 0}`}
                    aria-hidden="true"
                  />
                  {judge.scores[key] ?? 0}/2
                </dd>
              </div>
            ))}
          </dl>
          {judge.issues.length > 0 ? (
            <>
              <h5>{t(language, "Compare.issuesTheJudgeRaised")}</h5>
              <ul className="compare-issues">
                {judge.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="fine">{t(language, "Gallery.noIssuesRaised")}</p>
          )}
          <p className="fine compare-judge-summary">{judge.summary}</p>
        </div>
      ) : (
        item.status === "ready" && (
          <div className="compare-judge">
            <h4>{t(language, "Compare.judge")}</h4>
            <p className="fine">
              {t(language, "Compare.judgeSkipped")}
              {item.judgeSkipped ? ` (${item.judgeSkipped})` : ""}
            </p>
          </div>
        )
      )}
      <p className="fine compare-cost">
        {t(language, "Compare.latency")} {seconds(item.latencyMs)}
        {item.tokens &&
          item.tokens.input !== null &&
          item.tokens.output !== null && (
            <>
              {" · "}
              {t(language, "Compare.tokens")} {item.tokens.input}/
              {item.tokens.output}
            </>
          )}
      </p>
      {openHref && item.lesson && (
        <a
          className="lesson-link"
          href={openHref}
          aria-label={`${t(language, "Gallery.openLesson")}: ${title}`}
        >
          {t(language, "Gallery.openLesson")} <span aria-hidden="true">↗</span>
        </a>
      )}
      {action}
      {item.note && (
        <details className="lesson-source">
          <summary>{t(language, "Gallery.aboutThisLesson")}</summary>
          <p>{item.note}</p>
        </details>
      )}
    </section>
  );
}

// The frozen showcase: both models' replies to one evaluation case.
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
          <ModelColumn
            key={item.id}
            language={language}
            item={columnFromEvaluation(item, language)}
            openHref={`#lesson:${item.id}`}
          />
        ))}
      </div>
      <p className="gallery-footnote">{t(language, "Compare.footnote")}</p>
    </section>
  );
}

// A live comparison in Studio: the creator's own question, both replies from one request,
// and a button under each ready draft to carry it into the review flow.
export function LiveComparison({
  reply,
  language,
  busy,
  onUse,
  onDiscard,
}: {
  reply: CompareReply;
  language: Language;
  busy: boolean;
  onUse: (draft: CompareDraft) => void;
  onDiscard: () => void;
}) {
  const headingId = useId();
  return (
    <section className="comparison compare-panel" aria-labelledby={headingId}>
      <div className="section-title">
        <div>
          <p className="eyebrow">{t(language, "Compare.liveEyebrow")}</p>
          <h2 id={headingId}>{reply.question}</h2>
          <p className="fine">
            {t(language, "Compare.liveNote")}
            {reply.judge
              ? ` ${t(language, "Compare.judge")}: ${reply.judge}.`
              : ""}
          </p>
        </div>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onDiscard}
        >
          {t(language, "Compare.discard")}
        </button>
      </div>
      <div className="compare-grid">
        {reply.replies.map((draft, index) => (
          <ModelColumn
            key={`${draft.llm}-${index}`}
            language={language}
            item={columnFromDraft(draft, index)}
            action={
              draft.status === "ready" && draft.lesson ? (
                <div className="compare-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onUse(draft)}
                  >
                    {t(language, "Compare.useThisDraft")} →
                  </button>
                </div>
              ) : undefined
            }
          />
        ))}
      </div>
      <p className="gallery-footnote">{t(language, "Compare.footnoteLive")}</p>
    </section>
  );
}
