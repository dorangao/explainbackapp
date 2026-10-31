import { useMemo } from "react";
import source from "../../docs/evaluation.md?raw";
import { t } from "../lib/messages";
import { parseMarkdown } from "../lib/markdown";
import { EVALUATION_CARD_URL, EVALUATION_DOCS_URL } from "../lib/evaluation";
import type { Language } from "../lib/types";
import { Markdown } from "./Markdown";

// The evaluation card, read from `docs/evaluation.md` at build time so the page and the
// repository file cannot drift. Its sibling reports stay on GitHub and are linked there.
export function EvaluationPage({ language }: { language: Language }) {
  const blocks = useMemo(() => parseMarkdown(source, EVALUATION_DOCS_URL), []);
  const title = blocks.find((block) => block.kind === "heading");
  return (
    <section
      className="comparison evaluation-card"
      aria-labelledby={title?.kind === "heading" ? title.id : undefined}
    >
      <div className="section-title">
        <div>
          <p className="eyebrow">{t(language, "Evaluation.eyebrow")}</p>
          <p className="fine">
            {t(language, "Evaluation.note")}{" "}
            <a href={EVALUATION_CARD_URL} target="_blank" rel="noreferrer">
              {t(language, "Evaluation.source")}
            </a>
          </p>
        </div>
        <a className="text-link" href="#studio">
          {t(language, "LessonPlayer.backToLibrary")}
        </a>
      </div>
      <Markdown blocks={blocks} className="prose" />
    </section>
  );
}
