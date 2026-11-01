import { t } from "../lib/messages";
import {
  EVALUATION_CARD_HASH,
  EVALUATION_DOCS_URL,
  REPO_URL,
} from "../lib/evaluation";
import type { Language } from "../lib/types";
import { PageHeader } from "./PageHeader";

// The About destination: how a lesson is made and checked, what has been measured,
// the limits, and where the source lives. Plain sections under one page header.
export function About({ language }: { language: Language }) {
  return (
    <section className="about-page" aria-labelledby="about-title">
      <PageHeader
        language={language}
        crumbs={[
          { label: t(language, "App.library"), href: "#studio" },
          { label: t(language, "App.about") },
        ]}
        title={t(language, "About.title")}
        titleId="about-title"
        meta={t(language, "About.meta")}
      />
      <div className="about-grid">
        <section aria-labelledby="about-how">
          <h2 id="about-how">{t(language, "About.howItWorks")}</h2>
          <ol className="about-steps">
            <li>
              <strong>{t(language, "About.step1Title")}</strong>
              <span>{t(language, "About.step1Body")}</span>
            </li>
            <li>
              <strong>{t(language, "About.step2Title")}</strong>
              <span>{t(language, "About.step2Body")}</span>
            </li>
            <li>
              <strong>{t(language, "About.step3Title")}</strong>
              <span>{t(language, "About.step3Body")}</span>
            </li>
          </ol>
        </section>
        <section aria-labelledby="about-measured">
          <h2 id="about-measured">
            {t(language, "About.whatHasBeenMeasured")}
          </h2>
          <p>{t(language, "About.measuredBody")}</p>
          <p>
            <a className="lesson-link" href={EVALUATION_CARD_HASH}>
              {t(language, "Gallery.evaluationCard")}{" "}
              <span aria-hidden="true">↗</span>
            </a>
          </p>
        </section>
        <section aria-labelledby="about-limits">
          <h2 id="about-limits">{t(language, "About.limitsAndPrivacy")}</h2>
          <ul className="about-list">
            <li>{t(language, "About.limit1")}</li>
            <li>{t(language, "About.limit2")}</li>
            <li>{t(language, "About.limit3")}</li>
            <li>{t(language, "About.limit4")}</li>
            <li>{t(language, "About.limit5")}</li>
          </ul>
        </section>
        <section aria-labelledby="about-source">
          <h2 id="about-source">{t(language, "About.source")}</h2>
          <p>{t(language, "About.sourceBody")}</p>
          <ul className="about-list">
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                {t(language, "App.sourceOnGitHub")}
              </a>
            </li>
            <li>
              <a
                href={`${EVALUATION_DOCS_URL}architecture.md`}
                target="_blank"
                rel="noreferrer"
              >
                {t(language, "About.architectureNotes")}
              </a>
            </li>
            <li>
              <a
                href={`${EVALUATION_DOCS_URL}security.md`}
                target="_blank"
                rel="noreferrer"
              >
                {t(language, "About.securityNotes")}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </section>
  );
}
