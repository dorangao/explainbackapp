import { useEffect, useId, useMemo, useState } from "react";
import { t } from "../lib/messages";
import type { MessageKey } from "../lib/messages";
import {
  galleryLessons,
  gallerySourceNote,
  galleryShow,
  evaluationLessons,
  evaluationComparison,
  evaluationModelLabel,
  evaluationNote,
} from "../lib/shared";
import type {
  Bilingual,
  EvaluationItem,
  GalleryItem,
  Language,
} from "../lib/types";
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

// One library, three sources. Every lesson becomes the same entry so one card can show
// it; only the source badge, the meta line and the provenance note differ.
type Source = "reviewed" | "evaluation" | "shared";
type Entry = {
  id: string;
  href: string;
  kind: GalleryItem["kind"];
  source: Source;
  title: Bilingual;
  line: Bilingual;
  lineLead?: MessageKey;
  artId: string;
  image: string | null;
  sketch: boolean;
  show: string | null;
  compare: string | null;
  search: string[];
  reviewed?: GalleryItem;
  evaluation?: EvaluationItem;
  shared?: SavedSummary;
};
const fromReviewed = (item: GalleryItem): Entry => ({
  id: item.id,
  href: `#lesson:${item.id}`,
  kind: item.kind,
  source: "reviewed",
  title: item.lesson.title,
  line: item.summary,
  artId: item.id,
  image: item.image ?? null,
  sketch: item.source === "muse-sketch",
  show: galleryShow(item.id) ? `#show:${item.id}` : null,
  compare: null,
  search: [
    item.lesson.title.en,
    item.lesson.title.zh,
    item.summary.en,
    item.summary.zh,
    item.lesson.intro.en,
    item.lesson.intro.zh,
  ],
  reviewed: item,
});
const fromEvaluation = (item: EvaluationItem): Entry => ({
  id: item.id,
  href: `#lesson:${item.id}`,
  kind: item.kind,
  source: "evaluation",
  title: item.lesson.title,
  line: item.question,
  lineLead: "Gallery.theLearnerAsked",
  artId: item.kind === "process" ? "shared-process" : "shared-model",
  image: null,
  sketch: false,
  show: null,
  compare: evaluationComparison(item.caseId) ? `#compare:${item.caseId}` : null,
  search: [
    item.lesson.title.en,
    item.lesson.title.zh,
    item.question.en,
    item.question.zh,
    item.lesson.intro.en,
    item.lesson.intro.zh,
  ],
  evaluation: item,
});
const fromShared = (item: SavedSummary): Entry => ({
  id: `shared:${item.id}`,
  href: `#shared:${item.id}`,
  kind: item.kind,
  source: "shared",
  title: item.title,
  line: item.intro,
  artId: item.kind === "process" ? "shared-process" : "shared-model",
  image: item.cover ?? null,
  sketch: Boolean(item.sketch),
  show: null,
  compare: null,
  search: [item.title.en, item.title.zh, item.intro.en, item.intro.zh],
  shared: item,
});

type TypeFilter = "all" | GalleryItem["kind"];
type SourceFilter = "any" | Source;
const typeFilters: TypeFilter[] = ["all", "model", "process", "catalog"];
const sourceFilters: SourceFilter[] = [
  "any",
  "reviewed",
  "evaluation",
  "shared",
];
const typeKey: Record<TypeFilter, MessageKey> = {
  all: "Gallery.all",
  model: "Gallery.models",
  process: "Gallery.processes",
  catalog: "Gallery.series",
};
const sourceKey: Record<SourceFilter, MessageKey> = {
  any: "Gallery.any",
  reviewed: "Gallery.reviewed",
  evaluation: "Gallery.fromTheEvaluation",
  shared: "Gallery.shared",
};
const sourceBadgeKey: Record<Source, MessageKey> = {
  reviewed: "Gallery.reviewed",
  evaluation: "Gallery.fromTheEvaluation",
  shared: "Gallery.shared",
};
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
// Search both languages so a Chinese reader can find an English-titled shared lesson.
const matches = (query: string, fields: string[]) => {
  const q = normalize(query).trim();
  return !q || fields.some((field) => normalize(field).includes(q));
};

// The meta line names who made the lesson and what checked it, in a few words.
function metaLine(entry: Entry, language: Language): string {
  if (entry.evaluation) {
    const item = entry.evaluation;
    const issues =
      item.judge.issues.length === 0
        ? t(language, "Gallery.noIssuesRaised")
        : `${item.judge.issues.length} ${t(language, "Gallery.issuesRaised")}`;
    return `${evaluationModelLabel(item.model)} · ${t(language, "Gallery.judge")} ${item.judge.total}/${item.judge.max} · ${issues} · ${(item.latencyMs / 1000).toFixed(1)}\u00a0s`;
  }
  if (entry.shared) {
    const item = entry.shared;
    const date = new Intl.DateTimeFormat(
      language === "zh" ? "zh-CN" : "en-US",
      { dateStyle: "medium" },
    ).format(item.updatedAt);
    return [
      date,
      item.model,
      item.hasShow ? t(language, "Library.withShow") : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const source = entry.reviewed?.source;
  return t(
    language,
    source === "catalog"
      ? "Gallery.metaCatalog"
      : source === "author"
        ? "Gallery.metaAuthor"
        : source === "muse-sketch"
          ? "Gallery.metaSketch"
          : "Gallery.metaMuse",
  );
}
function provenance(entry: Entry, language: Language): string {
  if (entry.evaluation) return evaluationNote(entry.evaluation, language);
  if (entry.shared) return t(language, "Gallery.sharedProvenance");
  return gallerySourceNote(entry.reviewed?.source ?? "muse", language);
}

function LibraryCard({
  language,
  entry,
}: {
  language: Language;
  entry: Entry;
}) {
  const title = entry.title[language];
  return (
    <article className={`lesson-card lesson-card-${entry.source}`}>
      <a
        className="lesson-art-link"
        href={entry.href}
        tabIndex={-1}
        aria-hidden="true"
      >
        {entry.image ? (
          <img
            className="lesson-art lesson-art-image"
            src={entry.image}
            alt=""
            width={360}
            height={158}
            loading="lazy"
          />
        ) : (
          <LessonArt id={entry.artId} />
        )}
      </a>
      <div className="lesson-card-body">
        <span className="lesson-kind">
          {kindLabel(language, entry.kind)}
          <span className={`lesson-badge lesson-badge-${entry.source}`}>
            {t(language, sourceBadgeKey[entry.source])}
          </span>
          {entry.sketch && (
            <span className="lesson-badge lesson-badge-sketch">
              {t(language, "Gallery.fromASketch")}
            </span>
          )}
        </span>
        <h3>{title}</h3>
        <p className="lesson-line">
          {entry.lineLead && (
            <>
              <strong>{t(language, entry.lineLead)}</strong>{" "}
            </>
          )}
          {entry.line[language]}
        </p>
        <div className="lesson-actions">
          <a
            className="lesson-link"
            href={entry.href}
            aria-label={`${t(language, "Gallery.openLesson")}: ${title}`}
          >
            {t(language, "Gallery.openLesson")}{" "}
            <span aria-hidden="true">↗</span>
          </a>
          {entry.show && (
            <a
              className="lesson-link lesson-link-show"
              href={entry.show}
              aria-label={`${t(language, "Gallery.watchTheShow")}: ${title}`}
            >
              {t(language, "Gallery.watchTheShow")}{" "}
              <span aria-hidden="true">▶</span>
            </a>
          )}
          {entry.compare && entry.evaluation && (
            <a
              className="lesson-link lesson-link-compare"
              href={entry.compare}
              aria-label={`${t(language, "Gallery.compareTheTwoModels")}: ${entry.evaluation.question[language]}`}
            >
              {t(language, "Gallery.compareTheTwoModels")}{" "}
              <span aria-hidden="true">⇄</span>
            </a>
          )}
        </div>
        <p className="lesson-meta fine">{metaLine(entry, language)}</p>
        <details className="lesson-source">
          <summary>{t(language, "Gallery.aboutThisLesson")}</summary>
          <p>{provenance(entry, language)}</p>
        </details>
      </div>
    </article>
  );
}

// The hero's "start here" card: one reviewed lesson with a show, so a first visit has
// one obvious thing to open before the grid.
export function FeaturedLesson({
  language,
  id,
}: {
  language: Language;
  id: string;
}) {
  const item = galleryLessons.find((lesson) => lesson.id === id);
  if (!item) return null;
  const entry = fromReviewed(item);
  const title = entry.title[language];
  return (
    <article className="lesson-card featured-card">
      <a
        className="lesson-art-link"
        href={entry.href}
        tabIndex={-1}
        aria-hidden="true"
      >
        <LessonArt id={entry.artId} />
      </a>
      <div className="lesson-card-body">
        <span className="lesson-kind">
          <span className="lesson-badge lesson-badge-start">
            {t(language, "Gallery.startHere")}
          </span>
          {kindLabel(language, entry.kind)}
        </span>
        <h2>{title}</h2>
        <p className="lesson-line">{entry.line[language]}</p>
        <div className="lesson-actions">
          <a
            className="lesson-link"
            href={entry.href}
            aria-label={`${t(language, "Gallery.startHere")}: ${title}`}
          >
            {t(language, "Gallery.startHere")} <span aria-hidden="true">↗</span>
          </a>
          {entry.show && (
            <a
              className="lesson-link lesson-link-show"
              href={entry.show}
              aria-label={`${t(language, "Gallery.startWithTheShow")}: ${title}`}
            >
              {t(language, "Gallery.startWithTheShow")}{" "}
              <span aria-hidden="true">▶</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

export function Gallery({ language }: { language: Language }) {
  const headingId = useId(),
    searchId = useId();
  const [query, setQuery] = useState(""),
    [type, setType] = useState<TypeFilter>("all"),
    [source, setSource] = useState<SourceFilter>("any"),
    [withShow, setWithShow] = useState(false),
    [fromSketch, setFromSketch] = useState(false),
    [shared, setShared] = useState<SavedSummary[]>([]);
  // Shared lessons are public; a failed fetch simply leaves them out of the grid.
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
  const entries = useMemo(
    () => [
      ...galleryLessons.map(fromReviewed),
      ...evaluationLessons.map(fromEvaluation),
      ...shared.map(fromShared),
    ],
    [shared],
  );
  const shown = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (type === "all" || entry.kind === type) &&
          (source === "any" || entry.source === source) &&
          (!withShow || Boolean(entry.show || entry.shared?.hasShow)) &&
          (!fromSketch || entry.sketch) &&
          matches(query, entry.search),
      ),
    [entries, type, source, withShow, fromSketch, query],
  );
  const counts = {
    shows: entries.filter((entry) => entry.show || entry.shared?.hasShow)
      .length,
    compared: new Set(
      entries.filter((entry) => entry.compare).map((entry) => entry.compare),
    ).size,
  };
  return (
    <section className="gallery" id="library" aria-labelledby={headingId}>
      <div className="section-title">
        <div>
          <h2 id={headingId}>{t(language, "Gallery.theLibrary")}</h2>
          <p className="fine">
            {entries.length} {t(language, "Gallery.lessonCount")} ·{" "}
            {counts.shows} {t(language, "Gallery.withANarratedShow")} ·{" "}
            {counts.compared} {t(language, "Gallery.comparedAcrossTwoModels")}
          </p>
        </div>
        <span className="quiet-label">
          <span className="status-dot" />
          {t(language, "Gallery.freeToExploreNoSign")}
        </span>
      </div>
      <div className="catalog-tools">
        <label className="catalog-search">
          <span className="facet-legend">
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
        <fieldset className="facet">
          <legend className="facet-legend">
            {t(language, "Gallery.type")}
          </legend>
          <div className="catalog-filters">
            {typeFilters.map((value) => (
              <button
                key={value}
                type="button"
                className={type === value ? "chip on" : "chip"}
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {t(language, typeKey[value])}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="facet">
          <legend className="facet-legend">
            {t(language, "Gallery.source")}
          </legend>
          <div className="catalog-filters">
            {sourceFilters.map((value) => (
              <button
                key={value}
                type="button"
                className={source === value ? "chip on" : "chip"}
                aria-pressed={source === value}
                onClick={() => setSource(value)}
              >
                {t(language, sourceKey[value])}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="facet-toggles">
          <label className="facet-toggle">
            <input
              type="checkbox"
              checked={withShow}
              onChange={(event) => setWithShow(event.target.checked)}
            />
            {t(language, "Gallery.withAShow")}
          </label>
          <label className="facet-toggle">
            <input
              type="checkbox"
              checked={fromSketch}
              onChange={(event) => setFromSketch(event.target.checked)}
            />
            {t(language, "Gallery.fromASketch")}
          </label>
        </div>
        <span className="quiet-label catalog-count" aria-live="polite">
          {shown.length} {t(language, "Gallery.lessonCount")}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="catalog-empty">{t(language, "Gallery.noMatches")}</p>
      ) : (
        <div className="gallery-grid">
          {shown.map((entry) => (
            <LibraryCard key={entry.id} language={language} entry={entry} />
          ))}
        </div>
      )}
      <p className="gallery-footnote">
        {t(language, "Gallery.predictChangeAnInputExplain")}{" "}
        {t(language, "Gallery.gridFootnote")}
      </p>
    </section>
  );
}
