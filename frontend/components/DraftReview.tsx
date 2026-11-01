import { useState, useId } from "react";
import { CanvasBindingEditor } from "./CanvasBindingEditor";
import type { Detection } from "./Spotlight";
import { t } from "../lib/messages";
import type {
  Lesson,
  Language,
  Demo,
  References,
  TryoutReply,
} from "../lib/types";
import type { RequestMetrics } from "../hooks/useProviderSession";
import { RequestSummary } from "./RequestSummary";
import { CurrencyNote } from "./CurrencyNote";
import { CacheNote, actionLabel } from "./CacheNote";
import type { CacheState } from "./CacheNote";
import { say } from "../lib/types";
import {
  validateLesson,
  lessonLanguageWarnings,
  chapterExperiment,
  shownUnit,
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
            {shownUnit(demo.axis.unit)}
          </p>
          <div className="formula-list">
            {demo.outputs.map((o) => (
              <div key={o.id}>
                <span>
                  {o.label[language]}
                  {shownUnit(o.unit) && ` · ${o.unit}`}
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
                  {i.min}–{i.max} {shownUnit(i.unit)} ·{" "}
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
const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
// The pages a grounded draft rests on: the sheet's figures with their sources, and the
// sources the lesson itself names. Shown in the review and kept with the saved lesson.
export function SourcesPanel({
  language,
  references,
  sources,
}: {
  language: Language;
  references: References | null;
  sources: Lesson["sources"];
}) {
  if (!references && !sources?.length) return null;
  return (
    <details className="references" open>
      <summary>
        {t(language, "DraftReview.sources")}
        {references &&
          ` · ${t(language, "DraftReview.gatheredOn")} ${references.asOf}`}
      </summary>
      {references && (
        <ol className="reference-list">
          {references.facts.map((f) => (
            <li key={f.url + f.value}>
              <span>{f.statement[language]}</span>{" "}
              <strong>
                {f.value} {shownUnit(f.unit)}
              </strong>{" "}
              <a href={f.url} target="_blank" rel="noopener noreferrer">
                {f.title ?? host(f.url)}
              </a>
              {f.verified === false && (
                <span className="fine">
                  {" "}
                  · {t(language, "DraftReview.notInTheSearchResults")}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {sources && sources.length > 0 && (
        <p className="fine lesson-sources">
          {t(language, "DraftReview.theLessonNames")}{" "}
          {sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && " · "}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.title}
              </a>
            </span>
          ))}
        </p>
      )}
      <p className="fine">{t(language, "DraftReview.sourcesNote")}</p>
    </details>
  );
}
export function DraftReview({
  draft,
  references = null,
  language,
  busy,
  activeMode = null,
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
  onSave,
  savedId,
  saving,
  sourceImage,
  detection,
  onFind,
  pending: controlledPending,
  onPending,
  workspace = false,
  recoveryAvailable = true,
}: {
  pending?: Record<number, string>;
  onPending?: (value: Record<number, string>) => void;
  workspace?: boolean;
  recoveryAvailable?: boolean;
  draft: Lesson;
  references?: References | null;
  language: Language;
  busy: boolean;
  // The request in flight: a button says "Muse is working" only for its own.
  activeMode?: RequestMetrics["mode"] | null;
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
  // Keeps the lesson on the creator's shelf (no model request). Present when signed in.
  onSave?: () => void;
  savedId: string | null;
  saving: boolean;
  sourceImage?: string | null;
  detection?: Detection | null;
  onFind?: (concept: string) => void;
}) {
  const formId = useId();
  const [localPending, setLocalPending] = useState<Record<number, string>>({}),
    [error, setError] = useState(""),
    [connectionRemoved, setConnectionRemoved] = useState(false);
  const pending = controlledPending ?? localPending;
  const setPending = (
    change: (previous: Record<number, string>) => Record<number, string>,
  ) => {
    const next = change(pending);
    if (onPending) onPending(next);
    else setLocalPending(next);
  };
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
      const binding = next.chapters[index].canvas;
      delete next.chapters[index].canvas;
      next.chapters[index].demo = JSON.parse(pending[index]);
      const valid = validateLesson(next),
        demo = valid.chapters[index].demo;
      const keepBinding =
        binding &&
        demo?.kind === "model" &&
        demo.inputs.some((i) => i.id === binding.input);
      if (keepBinding) valid.chapters[index].canvas = binding;
      onChange(valid);
      setConnectionRemoved(Boolean(binding && !keepBinding));
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
          <h2 id={`${formId}-title`}>
            {workspace
              ? say(language, "Review and refine", "审阅与完善")
              : draft.title[language]}
          </h2>
        </div>
        {!workspace && (
          <button className="text-button" disabled={busy} onClick={onClose}>
            {t(language, "DraftReview.startANewLesson")}
          </button>
        )}
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
      {recoveryAvailable && (
        <p className="fine">
          {t(language, "DraftReview.thisDraftIsRemembered")}
        </p>
      )}
      <CurrencyNote language={language} currency={draft.currency} />
      <SourcesPanel
        language={language}
        references={references}
        sources={draft.sources}
      />
      <p className="review-notice">
        {t(language, "DraftReview.checkTheTeachingTextFormulas")}
      </p>
      {connectionRemoved && (
        <p className="notice" role="status">
          {say(
            language,
            "The previous picture connection no longer matches this definition. Select and confirm a new connection if needed.",
            "原来的图片关联不再匹配此定义。如有需要，请重新选择并确认关联。",
          )}
        </p>
      )}
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
            {sourceImage && chapter.demo?.kind === "model" && (
              <CanvasBindingEditor
                key={`${sourceImage}-${JSON.stringify(chapter.canvas)}-${JSON.stringify(chapter.demo.inputs)}`}
                image={sourceImage}
                language={language}
                demo={chapter.demo}
                value={chapter.canvas}
                detection={detection}
                onFind={onFind}
                busy={busy || hasPending}
                onChange={(binding) =>
                  change((next) => {
                    if (binding) next.chapters[index].canvas = binding;
                    else delete next.chapters[index].canvas;
                  })
                }
              />
            )}
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
            {activeMode === "tryout"
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
              {activeMode === "show"
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
      {generated && draft.version === 2 && (
        <label className="units-default">
          {t(language, "DraftReview.defaultUnits")}
          <select
            value={draft.units ?? "metric"}
            disabled={busy}
            onChange={(e) =>
              onChange({
                ...draft,
                units: e.target.value === "us" ? "us" : "metric",
              })
            }
          >
            <option value="metric">
              {t(language, "LessonPlayer.unitsMetric")}
            </option>
            <option value="us">{t(language, "LessonPlayer.unitsUs")}</option>
          </select>
          <small className="fine">
            {t(language, "DraftReview.defaultUnitsNote")}
          </small>
        </label>
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
        {onSave && (
          <button
            className="secondary save-action"
            disabled={busy || hasPending || saving}
            onClick={onSave}
          >
            {saving
              ? t(language, "Studio.loading")
              : t(
                  language,
                  savedId ? "Library.saveChanges" : "Library.saveToMyLessons",
                )}
          </button>
        )}
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
