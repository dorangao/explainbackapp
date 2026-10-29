import { useId } from "react";
import { t } from "../lib/messages";
import { galleryLessons, gallerySourceNote, galleryShow } from "../lib/shared";
import type { Language } from "../lib/types";
import { say } from "../lib/types";
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
export function Gallery({ language }: { language: Language }) {
  const headingId = useId();
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
      <div className="gallery-grid">
        {galleryLessons.map((item, index) => (
          <article className="lesson-card" key={item.id}>
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
                <span className="lesson-number">0{index + 1}</span>
                {say(
                  language,
                  {
                    model: "ADJUSTABLE MODEL",
                    process: "PROCESS EXPLORER",
                    catalog: "EXPERIMENT SERIES",
                  }[item.kind],
                  {
                    model: "可调模型",
                    process: "过程探索",
                    catalog: "系列实验",
                  }[item.kind],
                )}
              </span>
              <h3>{item.lesson.title[language]}</h3>
              {item.source === "muse-sketch" && (
                <span className="lesson-origin">
                  {t(language, "Gallery.createdFromASketch")}
                </span>
              )}
              <p>{item.summary[language]}</p>
              <a
                className="lesson-link"
                href={`#lesson:${item.id}`}
                aria-label={`${t(language, "Gallery.openLesson")}: ${item.lesson.title[language]}`}
              >
                {t(language, "Gallery.openLesson")}{" "}
                <span aria-hidden="true">↗</span>
              </a>
              {galleryShow(item.id) && (
                <a
                  className="lesson-link lesson-link-show"
                  href={`#show:${item.id}`}
                  aria-label={`${t(language, "Gallery.watchTheShow")}: ${item.lesson.title[language]}`}
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
        ))}
      </div>
      <p className="gallery-footnote">
        {t(language, "Gallery.predictChangeAnInputExplain")}
      </p>
    </section>
  );
}
