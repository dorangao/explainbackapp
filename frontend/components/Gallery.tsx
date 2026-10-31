import { useEffect, useId, useMemo, useState } from "react";
import { t } from "../lib/messages";
import {
  galleryLessons,
  gallerySourceNote,
  galleryShow,
  evaluationLessons,
  evaluationComparison,
  evaluationModelLabel,
  evaluationNote,
} from "../lib/shared";
import type { EvaluationItem, GalleryItem, Language } from "../lib/types";
import { EVALUATION_CARD_URL } from "../lib/evaluation";
import { listShared } from "../lib/library";
import type { SavedSummary } from "../lib/library";
import { kindLabel } from "./Library";
function LessonArt({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 360 158"
      aria-hidden="true"
      className={`lesson-art art-${id}`}
    >
      <path d="M30 126H330M48 25V126" className="art-grid" />
      {id === "cooling" ? (
        <>
          <path
            d="M55 30C91 79 123 100 170 111S270 120 325 121"
            className="art-line"
          />
          <path d="M48 121H330" className="art-dashed" />
          <circle cx="125" cy="94" r="5" className="art-dot" />
          <text x="243" y="41">
            T(t)
          </text>
        </>
      ) : id === "pendulum" ? (
        <>
          <path
            d="M129 33h100M180 33l-47 72M180 33l47 72"
            className="art-dashed"
          />
          <path
            d="M180 33l30 87M117 104Q180 145 242 104"
            className="art-line"
          />
          <circle cx="210" cy="120" r="11" className="art-dot" />
          <circle cx="180" cy="33" r="4" className="art-dot" />
          <text x="226" y="68">
            L
          </text>
        </>
      ) : id === "web-cache" ? (
        <>
          <path d="M78 70H280" className="art-line" />
          <rect
            x="61"
            y="51"
            width="55"
            height="39"
            rx="6"
            className="art-box"
          />
          <rect
            x="151"
            y="51"
            width="55"
            height="39"
            rx="6"
            className="art-box"
          />
          <rect
            x="243"
            y="51"
            width="55"
            height="39"
            rx="6"
            className="art-box"
          />
          <path d="M177 96v19h-85V96" className="art-dashed" />
          <text x="77" y="77" className="art-label">
            01
          </text>
          <text x="167" y="77" className="art-label">
            02
          </text>
          <text x="259" y="77" className="art-label">
            03
          </text>
        </>
      ) : id === "vehicle" ? (
        <>
          <path
            d="M45 113Q103 112 135 70T240 55Q265 95 310 113"
            className="art-dashed"
          />
          <g transform="translate(181 54) rotate(-24)">
            <rect
              x="-32"
              y="-13"
              width="64"
              height="26"
              rx="9"
              className="art-box"
            />
            <circle cx="-20" cy="17" r="6" className="art-dot" />
            <circle cx="20" cy="17" r="6" className="art-dot" />
          </g>
          <text x="67" y="52">
            F = ma
          </text>
        </>
      ) : id === "shared-model" ? (
        <>
          <path
            d="M55 110C110 40 170 40 230 90S300 105 325 60"
            className="art-line"
          />
          <circle cx="230" cy="90" r="5" className="art-dot" />
          <text x="70" y="48">
            y(x)
          </text>
        </>
      ) : id === "shared-process" ? (
        <>
          <path d="M70 80H290" className="art-dashed" />
          <circle cx="90" cy="80" r="12" className="art-box" />
          <circle cx="180" cy="80" r="12" className="art-box" />
          <circle cx="270" cy="80" r="12" className="art-box" />
          <path d="M102 80h66M192 80h66" className="art-line" />
        </>
      ) : (
        <>
          <path
            d="M50 81Q85 15 120 81T190 81T260 81T330 81"
            className="art-line"
          />
          <path
            d="M50 81Q85 147 120 81T190 81T260 81T330 81"
            className="art-dashed"
          />
          <text x="75" y="34">
            |ψ⟩
          </text>
        </>
      )}
    </svg>
  );
}
type Filter =
  "all" | "model" | "process" | "catalog" | "sketch" | "show" | "evaluation";
const filters: Filter[] = [
  "all",
  "model",
  "process",
  "catalog",
  "sketch",
  "show",
  "evaluation",
];
const filterLabel = (language: Language, filter: Filter) =>
  t(
    language,
    (
      {
        all: "Gallery.all",
        model: "Gallery.models",
        process: "Gallery.processes",
        catalog: "Gallery.series",
        sketch: "Gallery.fromASketch",
        show: "Gallery.withAShow",
        evaluation: "Gallery.fromTheEvaluation",
      } as const
    )[filter],
  );
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
// Search both languages so a Chinese reader can find an English-titled shared lesson.
const matches = (query: string, fields: string[]) => {
  const q = normalize(query).trim();
  return !q || fields.some((field) => normalize(field).includes(q));
};
function LessonCard({
  language,
  index,
  item,
}: {
  language: Language;
  index: number;
  item: GalleryItem;
}) {
  const title = item.lesson.title[language];
  return (
    <article className="lesson-card">
      <a
        className="lesson-art-link"
        href={`#lesson:${item.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.image ? (
          <img
            className="lesson-art lesson-art-image"
            src={item.image}
            alt=""
            width={360}
            height={158}
            loading="lazy"
          />
        ) : (
          <LessonArt id={item.id} />
        )}
      </a>
      <div className="lesson-card-body">
        <span className="lesson-kind">
          <span className="lesson-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          {kindLabel(language, item.kind)}
        </span>
        <h3>{title}</h3>
        {item.source === "muse-sketch" && (
          <span className="lesson-origin">
            {t(language, "Gallery.createdFromASketch")}
          </span>
        )}
        <p>{item.summary[language]}</p>
        <a
          className="lesson-link"
          href={`#lesson:${item.id}`}
          aria-label={`${t(language, "Gallery.openLesson")}: ${title}`}
        >
          {t(language, "Gallery.openLesson")} <span aria-hidden="true">↗</span>
        </a>
        {galleryShow(item.id) && (
          <a
            className="lesson-link lesson-link-show"
            href={`#show:${item.id}`}
            aria-label={`${t(language, "Gallery.watchTheShow")}: ${title}`}
          >
            {t(language, "Gallery.watchTheShow")}{" "}
            <span aria-hidden="true">▶</span>
          </a>
        )}
        <details className="lesson-source">
          <summary>{t(language, "Gallery.aboutThisLesson")}</summary>
          <p>{gallerySourceNote(item.source, language)}</p>
        </details>
      </div>
    </article>
  );
}
function EvaluationCard({
  language,
  item,
}: {
  language: Language;
  item: EvaluationItem;
}) {
  const title = item.lesson.title[language];
  const comparison = evaluationComparison(item.caseId);
  return (
    <article className="lesson-card lesson-card-evaluation">
      <a
        className="lesson-art-link"
        href={`#lesson:${item.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        <LessonArt
          id={item.kind === "process" ? "shared-process" : "shared-model"}
        />
      </a>
      <div className="lesson-card-body">
        <span className="lesson-kind">
          <span className="lesson-badge lesson-badge-model">
            {evaluationModelLabel(item.model)}
          </span>
          {kindLabel(language, item.kind)}
        </span>
        <h3>{title}</h3>
        <p className="evaluation-question">
          <strong>{t(language, "Gallery.theLearnerAsked")}</strong>{" "}
          {item.question[language]}
        </p>
        <a
          className="lesson-link"
          href={`#lesson:${item.id}`}
          aria-label={`${t(language, "Gallery.openLesson")}: ${title}`}
        >
          {t(language, "Gallery.openLesson")} <span aria-hidden="true">↗</span>
        </a>
        {comparison && (
          <a
            className="lesson-link lesson-link-compare"
            href={`#compare:${item.caseId}`}
            aria-label={`${t(language, "Gallery.compareTheTwoModels")}: ${item.question[language]}`}
          >
            {t(language, "Gallery.compareTheTwoModels")}{" "}
            <span aria-hidden="true">⇄</span>
          </a>
        )}
        <p className="lesson-meta fine">
          {t(language, "Gallery.judge")} {item.judge.total}/{item.judge.max}
          {" · "}
          {item.judge.issues.length === 0
            ? t(language, "Gallery.noIssuesRaised")
            : `${item.judge.issues.length} ${t(language, "Gallery.issuesRaised")}`}
          {" · "}
          {(item.latencyMs / 1000).toFixed(1)} s
        </p>
        <details className="lesson-source">
          <summary>{t(language, "Gallery.aboutThisLesson")}</summary>
          <p>{evaluationNote(item, language)}</p>
        </details>
      </div>
    </article>
  );
}
function SharedCard({
  language,
  item,
}: {
  language: Language;
  item: SavedSummary;
}) {
  const title = item.title[language];
  return (
    <article className="lesson-card lesson-card-shared">
      <a
        className="lesson-art-link"
        href={`#shared:${item.id}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {item.cover ? (
          <img
            className="lesson-art lesson-art-image"
            src={item.cover}
            alt=""
            width={360}
            height={158}
            loading="lazy"
          />
        ) : (
          <LessonArt
            id={item.kind === "process" ? "shared-process" : "shared-model"}
          />
        )}
      </a>
      <div className="lesson-card-body">
        <span className="lesson-kind">
          <span className="lesson-badge">
            {t(language, "Gallery.sharedBadge")}
          </span>
          {kindLabel(language, item.kind)}
        </span>
        <h3>{title}</h3>
        {item.sketch && (
          <span className="lesson-origin">
            {t(language, "Gallery.createdFromASketch")}
          </span>
        )}
        <p>{item.intro[language]}</p>
        <a
          className="lesson-link"
          href={`#shared:${item.id}`}
          aria-label={`${t(language, "Gallery.openLesson")}: ${title}`}
        >
          {t(language, "Gallery.openLesson")} <span aria-hidden="true">↗</span>
        </a>
        <p className="lesson-meta fine">
          {new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
            dateStyle: "medium",
          }).format(item.updatedAt)}
          {item.model && ` · ${item.model}`}
          {item.hasShow && ` · ${t(language, "Library.withShow")}`}
        </p>
      </div>
    </article>
  );
}
export function Gallery({ language }: { language: Language }) {
  const headingId = useId(),
    searchId = useId();
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState<Filter>("all"),
    [shared, setShared] = useState<SavedSummary[]>([]);
  // Shared lessons are public; a failed fetch simply leaves the section out.
  useEffect(() => {
    let live = true;
    void listShared()
      .then((result) => {
        if (live) setShared(result.lessons);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const reviewed = useMemo(
    () =>
      galleryLessons.filter(
        (item) =>
          (filter === "all" ||
            (filter === "sketch"
              ? item.source === "muse-sketch"
              : filter === "show"
                ? Boolean(galleryShow(item.id))
                : item.kind === filter)) &&
          matches(query, [
            item.lesson.title.en,
            item.lesson.title.zh,
            item.summary.en,
            item.summary.zh,
            item.lesson.intro.en,
            item.lesson.intro.zh,
          ]),
      ),
    [filter, query],
  );
  const showcase = useMemo(
    () =>
      evaluationLessons.filter(
        (item) =>
          (filter === "all" ||
            filter === "evaluation" ||
            item.kind === filter) &&
          matches(query, [
            item.lesson.title.en,
            item.lesson.title.zh,
            item.question.en,
            item.question.zh,
            item.lesson.intro.en,
            item.lesson.intro.zh,
          ]),
      ),
    [filter, query],
  );
  const community = useMemo(
    () =>
      shared.filter(
        (item) =>
          (filter === "all" ||
            (filter === "show"
              ? item.hasShow
              : filter === "sketch"
                ? Boolean(item.sketch)
                : item.kind === filter)) &&
          matches(query, [
            item.title.en,
            item.title.zh,
            item.intro.en,
            item.intro.zh,
          ]),
      ),
    [shared, filter, query],
  );
  const total = reviewed.length + showcase.length + community.length;
  return (
    <section className="gallery" aria-labelledby={headingId}>
      <div className="section-title">
        <div>
          <p className="eyebrow">{t(language, "Gallery.theLearningLibrary")}</p>
          <h2 id={headingId}>{t(language, "Gallery.findAQuestionTryIt")}</h2>
        </div>
        <span className="quiet-label">
          <span className="status-dot" />
          {t(language, "Gallery.freeToExploreNoSign")}
        </span>
      </div>
      <div className="catalog-tools">
        <label className="catalog-search">
          <span className="sr-only">
            {t(language, "Gallery.searchLessons")}
          </span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(language, "Gallery.searchPlaceholder")}
            aria-label={t(language, "Gallery.searchLessons")}
          />
        </label>
        <div
          className="catalog-filters"
          role="group"
          aria-label={t(language, "Gallery.all")}
        >
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "chip on" : "chip"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {filterLabel(language, value)}
            </button>
          ))}
        </div>
        <span className="quiet-label catalog-count" aria-live="polite">
          {total} {t(language, "Gallery.lessonCount")}
        </span>
      </div>
      {total === 0 ? (
        <p className="catalog-empty">{t(language, "Gallery.noMatches")}</p>
      ) : (
        <div className="gallery-grid">
          {reviewed.map((item, index) => (
            <LessonCard
              key={item.id}
              language={language}
              index={index}
              item={item}
            />
          ))}
        </div>
      )}
      {showcase.length > 0 && (
        <section
          className="shared-section evaluation-section"
          aria-label={t(language, "Gallery.fromTheEvaluationEyebrow")}
        >
          <div className="section-title">
            <div>
              <p className="eyebrow">
                {t(language, "Gallery.fromTheEvaluationEyebrow")}
              </p>
              <h2>{t(language, "Gallery.whatMuseMadeFromAQuestion")}</h2>
              <p className="fine">
                {t(language, "Gallery.evaluationSectionNote")}{" "}
                <a href={EVALUATION_CARD_URL} target="_blank" rel="noreferrer">
                  {t(language, "Gallery.evaluationCard")}
                </a>
              </p>
            </div>
          </div>
          <div className="gallery-grid">
            {showcase.map((item) => (
              <EvaluationCard key={item.id} language={language} item={item} />
            ))}
          </div>
        </section>
      )}
      {community.length > 0 && (
        <section
          className="shared-section"
          aria-label={t(language, "Gallery.sharedByCreators")}
        >
          <div className="section-title">
            <div>
              <p className="eyebrow">
                {t(language, "Gallery.sharedByCreators")}
              </p>
              <h2>{t(language, "Gallery.freshFromTheStudio")}</h2>
              <p className="fine">{t(language, "Gallery.sharedNote")}</p>
            </div>
          </div>
          <div className="gallery-grid">
            {community.map((item) => (
              <SharedCard key={item.id} language={language} item={item} />
            ))}
          </div>
        </section>
      )}
      <p className="gallery-footnote">
        {t(language, "Gallery.predictChangeAnInputExplain")}
      </p>
    </section>
  );
}
