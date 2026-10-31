import { useMemo } from "react";
import source from "../../docs/evaluation.md?raw";
import { t } from "../lib/messages";
import { parseMarkdown } from "../lib/markdown";
import { EVALUATION_CARD_URL, EVALUATION_DOCS_URL } from "../lib/evaluation";
import type { Language } from "../lib/types";
import { Markdown } from "./Markdown";
import { PageHeader } from "./PageHeader";

// The evaluation card, read from `docs/evaluation.md` at build time so the page and the
// repository file cannot drift. This public document contains methods and limits only.
export function EvaluationPage({ language }: { language: Language }) {
  const blocks = useMemo(() => parseMarkdown(source, EVALUATION_DOCS_URL), []);
  const [first, ...rest] = blocks;
  const body = first?.kind === "heading" && first.level === 1 ? rest : blocks;
  return (
    <section
      className="comparison evaluation-card"
      aria-labelledby="evaluation-card"
    >
      <PageHeader
        language={language}
        crumbs={[
          { label: t(language, "App.library"), href: "#studio" },
          { label: t(language, "Gallery.evaluationCard") },
        ]}
        title={
          first?.kind === "heading"
            ? first.children
                .map((node) => ("text" in node ? node.text : ""))
                .join("")
            : t(language, "Gallery.evaluationCard")
        }
        titleId="evaluation-card"
        meta={
          <>
            {t(language, "Evaluation.note")}{" "}
            <a href={EVALUATION_CARD_URL} target="_blank" rel="noreferrer">
              {t(language, "Evaluation.source")}
            </a>
          </>
        }
      />
      <Markdown blocks={body} className="prose" />
    </section>
  );
}
