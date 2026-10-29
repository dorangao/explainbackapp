import { useState, useId } from "react";
import { t } from "../lib/messages";
import type { Lesson, Language, Demo, TryoutReply } from "../lib/types";
import type { RequestMetrics } from "../hooks/useProviderSession";
import { RequestSummary } from "./RequestSummary";
import { CacheNote, actionLabel } from "./CacheNote";
import type { CacheState } from "./CacheNote";
import { say } from "../lib/types";
import {
  validateLesson,
  lessonLanguageWarnings,
  chapterExperiment,
} from "../lib/shared";
function Definition({
  demo,
  language,
  value,
  onEdit,
  onApply,
  onDiscard,
  busy,
}: {
  demo: Demo;
  language: Language;
  value?: string;
  onEdit: (value: string) => void;
  onApply: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  return (
    <details className="definition" open>
      <summary>{t(language, "DraftReview.reviewTheGeneratedDemo")}</summary>
      <p>{demo.assumptions[language]}</p>
      {demo.kind === "model" ? (
        <>
          <p className="fine">
            {demo.axis.label[language]}: {demo.axis.min} → {demo.axis.max}{" "}
            {demo.axis.unit}
          </p>
          <div className="formula-list">
            {demo.outputs.map((o) => (
              <div key={o.id}>
                <span>
                  {o.label[language]} · {o.unit}
                </span>
                <code>{o.expression}</code>
              </div>
            ))}
          </div>
          <dl className="input-ranges">
            {demo.inputs.map((i) => (
              <div key={i.id}>
                <dt>{i.label[language]}</dt>
                <dd>
                  {i.min}–{i.max} {i.unit} ·{" "}
                  {t(language, "DraftReview.startsAt")} {i.value}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <>
          <ol>
            {demo.stages.map((s, i) => (
              <li key={i}>
                <strong>{s.title[language]}</strong> — {s.detail[language]}
              </li>
            ))}
          </ol>
          <details>
            <summary>
              {t(language, "DraftReview.reviewTheAuthoredAnswer")}
            </summary>
            <p>{demo.transfer.question[language]}</p>
            <p>{demo.transfer.choices[demo.transfer.answer][language]}</p>
            <p>{demo.transfer.rationale[language]}</p>
          </details>
        </>
      )}
      <details className="definition-editor">
        <summary>
          {t(language, "DraftReview.editFormulasControlsOrSteps")}
        </summary>
        <label>
          {t(language, "DraftReview.bilingualDemoDefinition")}
          <textarea
            value={value ?? JSON.stringify(demo, null, 2)}
            onChange={(e) => onEdit(e.target.value)}
            maxLength={24000}
            rows={12}
            disabled={busy}
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={onApply}
            disabled={busy || value === undefined}
          >
            {t(language, "DraftReview.validateApplyDefinition")}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={onDiscard}
            disabled={busy || value === undefined}
          >
            {t(language, "DraftReview.discardDefinitionEdits")}
          </button>
        </div>
      </details>
    </details>
  );
}
// What the test learner reported, chapter by chapter. Answers were checked by code on the
// server; the confusions and suggestions are the model's opinion for the author to weigh.
function TryoutReport({
  tryout,
  language,
  metrics,
  onUse,
}: {
  tryout: TryoutReply;
  language: Language;
  metrics: RequestMetrics | null;
  onUse: (text: string) => void;
}) {
  const suggestions = tryout.chapters.flatMap((c) => c.suggestions);
  const prediction = {
    agree: t(language, "DraftReview.agree"),
    disagree: t(language, "DraftReview.disagree"),
    unsure: t(language, "DraftReview.notSure"),
  };
  const items = (list: string[]) =>
    list.length === 0 ? (
      t(language, "DraftReview.noneReported")
    ) : (
      <ul>
        {list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  return (
    <div className="tryout-report" role="status">
      <p>
        <strong>{t(language, "DraftReview.overall")}:</strong> {tryout.overall}{" "}
        <span
          className="verdict"
          data-verdict={
            tryout.rating >= 4
              ? "supported"
              : tryout.rating >= 3
                ? "partly"
                : "unsupported"
          }
        >
          {tryout.rating}/5 {t(language, "DraftReview.clarityRating")}
        </span>
      </p>
      {tryout.chapters.map((c, i) => (
        <div key={i}>
          <h3>
            {t(language, "DraftReview.chapter")} {i + 1}
          </h3>
          <dl>
            <dt>{t(language, "DraftReview.predicted")}</dt>
            <dd>
              {prediction[c.prediction]} · {c.reason}
            </dd>
            <dt>{t(language, "DraftReview.explainedBack")}</dt>
            <dd>{c.explanation}</dd>
            <dt>{t(language, "DraftReview.transferAnswer")}</dt>
            <dd>
              {c.transfer.type === "choice"
                ? (c.transfer.choice ?? c.transfer.given)
                : `${c.transfer.given} ${c.transfer.unit ?? ""}`.trim()}{" "}
              <span
                className="verdict"
                data-verdict={c.transfer.correct ? "supported" : "unsupported"}
              >
                {t(
                  language,
                  c.transfer.correct
                    ? "DraftReview.correct"
                    : "DraftReview.incorrect",
                )}
              </span>
            </dd>
            <dt>{t(language, "DraftReview.confusions")}</dt>
            <dd>{items(c.confusions)}</dd>
            <dt>{t(language, "DraftReview.suggestions")}</dt>
            <dd>{items(c.suggestions)}</dd>
          </dl>
        </div>
      ))}
      <RequestSummary
        metrics={metrics?.mode === "tryout" ? metrics : null}
        language={language}
      />
      {suggestions.length > 0 && (
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => onUse(suggestions.join(" ").slice(0, 600))}
          >
            {t(language, "DraftReview.useTheseSuggestionsIn")}
          </button>
        </div>
      )}
    </div>
  );
}
export function DraftReview({
  draft,
  language,
  busy,
  reviewed,
  setReviewed,
  onChange,
  onPresent,
  onExport,
  onClose,
  onRevise,
  canRequest,
  tryout,
  onTryout,
  testerLabel,
  metrics,
  hasShow,
  onMakeShow,
  onWatchShow,
  revision,
  setRevision,
  caches,
  onRecreate,
}: {
  draft: Lesson;
  language: Language;
  busy: boolean;
  reviewed: boolean;
  setReviewed: (v: boolean) => void;
  onChange: (v: Lesson) => void;
  onPresent: () => void;
  onExport: () => void;
  onClose: () => void;
  onRevise: (value: string) => void;
  canRequest: boolean;
  tryout: TryoutReply | null;
  onTryout: () => void;
  testerLabel: string | null;
  metrics: RequestMetrics | null;
  hasShow: boolean;
  onMakeShow: () => void;
  onWatchShow: () => void;
  // The revision prompt lives in Studio so it is remembered with the draft.
  revision: string;
  setRevision: (value: string) => void;
  // Per model-backed action: when it last answered and whether its inputs changed since.
  caches: {
    compose: CacheState;
    revise: CacheState;
    tryout: CacheState;
    show: CacheState;
  };
  onRecreate: () => void;
}) {
  const formId = useId();
  const [pending, setPending] = useState<Record<number, string>>({}),
    [error, setError] = useState("");
  const generated = draft.chapters.some((c) => c.demo),
    hasPending = Object.keys(pending).length > 0,
    warnings = lessonLanguageWarnings(draft);
  const change = (mutate: (value: Lesson) => void) => {
    const next = structuredClone(draft);
    mutate(next);
    onChange(next);
  };
  function apply(index: number) {
    try {
      const next = structuredClone(draft);
      next.chapters[index].demo = JSON.parse(pending[index]);
      onChange(validateLesson(next));
      setPending((p) => {
        const n = { ...p };
        delete n[index];
        return n;
      });
      setError("");
    } catch {
      setError(t(language, "DraftReview.definitionRejectedCheckBothLanguages"));
    }
  }
  const editChapter = (
    index: number,
    key: "framing" | "explanation",
    value: string,
  ) =>
    change((next) => {
      next.chapters[index][key][language] = value;
    });
  return (
    <section className="draft-review" aria-labelledby={`${formId}-title`}>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{t(language, "DraftReview.02ReviewRefine")}</p>
          <h2 id={`${formId}-title`}>{draft.title[language]}</h2>
        </div>
        <button className="text-button" disabled={busy} onClick={onClose}>
          {t(language, "DraftReview.startANewLesson")}
        </button>
      </div>
      <p className="lead-small">{draft.intro[language]}</p>
      {caches.compose && (
        <div className="cache-row">
          <span className="fine">{t(language, "Cache.draftedByMuse")}</span>
          <CacheNote cache={caches.compose} language={language} />
          {canRequest && (
            <button
              type="button"
              className="text-button"
              disabled={busy || hasPending}
              onClick={onRecreate}
            >
              {t(language, "Cache.reRunCreate")}
            </button>
          )}
        </div>
      )}
      <p className="fine">{t(language, "DraftReview.thisDraftIsRemembered")}</p>
      <p className="review-notice">
        {t(language, "DraftReview.checkTheTeachingTextFormulas")}
      </p>
      {warnings.length > 0 && (
        <p className="notice" role="status">
          {t(language, "DraftReview.checkBothTranslationsUnexpectedCyrillic")}
          {warnings.join(", ")}
        </p>
      )}
      <div className="review-chapters">
        {draft.chapters.map((chapter, index) => (
          <article
            className="review-chapter"
            key={`${index}-${chapter.experiment}`}
          >
            <div className="chapter-heading">
              <span className="chapter-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>
                {chapter.demo?.title[language] ??
                  chapterExperiment(chapter, 0, language).title}
              </h3>
              <div className="actions">
                <button
                  className="text-button"
                  disabled={busy || index === 0 || hasPending}
                  onClick={() =>
                    change((next) => {
                      [next.chapters[index - 1], next.chapters[index]] = [
                        next.chapters[index],
                        next.chapters[index - 1],
                      ];
                    })
                  }
                >
                  {t(language, "DraftReview.moveUp")}
                </button>
                <button
                  className="text-button"
                  disabled={busy || draft.chapters.length === 1 || hasPending}
                  onClick={() =>
                    change((next) => {
                      next.chapters.splice(index, 1);
                    })
                  }
                >
                  {t(language, "DraftReview.remove")}
                </button>
              </div>
            </div>
            <p>{chapter.framing[language]}</p>
            <blockquote>
              {chapter.demo?.claim[language] ??
                chapterExperiment(chapter, 0, language).claim}
            </blockquote>
            {chapter.demo && (
              <Definition
                demo={chapter.demo}
                language={language}
                value={pending[index]}
                busy={busy}
                onEdit={(value) => {
                  setPending((p) => ({ ...p, [index]: value }));
                  setReviewed(false);
                }}
                onApply={() => apply(index)}
                onDiscard={() => {
                  setPending((p) => {
                    const n = { ...p };
                    delete n[index];
                    return n;
                  });
                  setReviewed(false);
                }}
              />
            )}
          </article>
        ))}
      </div>
      <details className="edit-text">
        <summary>{t(language, "DraftReview.editLessonText")}</summary>
        <div className="form-grid">
          <label>
            {t(language, "DraftReview.lessonTitle")}
            <input
              value={draft.title[language]}
              onChange={(e) =>
                change((next) => {
                  next.title[language] = e.target.value;
                })
              }
              maxLength={80}
              disabled={busy}
            />
          </label>
          <label>
            {t(language, "DraftReview.introduction")}
            <textarea
              value={draft.intro[language]}
              onChange={(e) =>
                change((next) => {
                  next.intro[language] = e.target.value;
                })
              }
              maxLength={200}
              rows={2}
              disabled={busy}
            />
          </label>
        </div>
        {draft.chapters.map((chapter, index) => (
          <fieldset key={index}>
            <legend>
              {index + 1} · {t(language, "DraftReview.chapterText")}
            </legend>
            {(["framing", "explanation"] as const).map((key) => (
              <label key={key}>
                {say(
                  language,
                  key === "framing"
                    ? "Scene / question"
                    : "Explanation after testing",
                  key === "framing" ? "情境 / 问题" : "实验后的解释",
                )}
                <textarea
                  value={chapter[key][language]}
                  onChange={(e) => editChapter(index, key, e.target.value)}
                  maxLength={key === "framing" ? 180 : 260}
                  rows={3}
                  disabled={busy}
                />
              </label>
            ))}
          </fieldset>
        ))}
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {canRequest && (
        <section
          className="tryout-section"
          aria-labelledby={`${formId}-tryout`}
        >
          <p className="eyebrow" id={`${formId}-tryout`}>
            {t(language, "DraftReview.testLearnerReport")}
          </p>
          <p className="fine">
            {t(language, "DraftReview.testLearnerIntro")}
            {testerLabel ? ` · ${testerLabel}` : ""}
          </p>
          <button
            type="button"
            className="secondary"
            disabled={busy || hasPending}
            onClick={onTryout}
          >
            {busy
              ? t(language, "DraftReview.museIsWorking")
              : actionLabel(
                  language,
                  t(language, "DraftReview.letTheTestLearnerTry"),
                  caches.tryout,
                )}
          </button>
          <CacheNote cache={caches.tryout} language={language} />
          {tryout && (
            <TryoutReport
              tryout={tryout}
              language={language}
              metrics={metrics}
              onUse={setRevision}
            />
          )}
        </section>
      )}
      {canRequest && (
        <section className="tryout-section" aria-labelledby={`${formId}-show`}>
          <p className="eyebrow" id={`${formId}-show`}>
            {t(language, "DraftReview.lessonShow")}
          </p>
          <p className="fine">{t(language, "DraftReview.lessonShowIntro")}</p>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={busy || hasPending}
              onClick={onMakeShow}
            >
              {busy
                ? t(language, "DraftReview.museIsWorking")
                : actionLabel(
                    language,
                    t(language, "DraftReview.makeANarratedShow"),
                    caches.show,
                  )}
            </button>
            {hasShow && (
              <button type="button" disabled={busy} onClick={onWatchShow}>
                {t(language, "DraftReview.watchTheShow")} ▶
              </button>
            )}
          </div>
          <CacheNote cache={caches.show} language={language} />
          {hasShow && metrics?.mode === "show" && (
            <RequestSummary metrics={metrics} language={language} />
          )}
        </section>
      )}
      {canRequest && (
        <section className="revision-section">
          <label htmlFor={`${formId}-revision`}>
            {t(language, "DraftReview.askMuseToReviseThis")}
          </label>
          <textarea
            id={`${formId}-revision`}
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            maxLength={600}
            rows={2}
            placeholder={t(
              language,
              "DraftReview.oneChangeSimplifyTheExplanation",
            )}
            disabled={busy}
          />
          <button
            className="secondary"
            disabled={busy || hasPending || !revision.trim()}
            onClick={() => onRevise(revision)}
          >
            {actionLabel(
              language,
              t(language, "DraftReview.reviseLessonDemo"),
              caches.revise,
            )}
          </button>
          <CacheNote cache={caches.revise} language={language} />
        </section>
      )}
      {generated && (
        <label className="review-check">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            disabled={busy || hasPending}
          />
          <span>{t(language, "DraftReview.iReviewedTheDemoDefinition")}</span>
        </label>
      )}
      {hasPending && (
        <p className="notice">
          {t(language, "DraftReview.applyOrDiscardDefinitionEdits")}
        </p>
      )}
      <div className="actions review-actions">
        <button
          disabled={busy || hasPending || (generated && !reviewed)}
          onClick={onPresent}
        >
          {t(language, "DraftReview.presentThisLesson")}
        </button>
        <button
          className="secondary"
          disabled={busy || hasPending}
          onClick={onExport}
        >
          {t(language, "DraftReview.exportLessonJson")}
        </button>
      </div>
    </section>
  );
}
