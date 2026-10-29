import { t } from "../lib/messages";
import type { Language } from "../lib/types";
import type { RequestMetrics } from "../hooks/useProviderSession";

// One line per accepted request: which model answered, how long the server measured, tokens.
export function RequestSummary({
  metrics,
  language,
}: {
  metrics: RequestMetrics | null;
  language: Language;
}) {
  if (!metrics) return null;
  const seconds = (metrics.elapsedMs / 1000).toFixed(1);
  const verb = {
    compose: t(language, "RevisionSummary.draftedThisLesson"),
    revise: t(language, "RevisionSummary.revisedThisLesson"),
    guide: t(language, "RevisionSummary.explainedThisResult"),
    tryout: t(language, "RevisionSummary.triedThisLessonAs"),
    show: t(language, "RevisionSummary.wroteTheShowFor"),
    transcribe: t(language, "RevisionSummary.transcribedYourExplanation"),
  }[metrics.mode];
  const tokens =
    metrics.usage && (metrics.usage.input ?? metrics.usage.output) !== null
      ? ` · ${metrics.usage.input ?? "—"} ${t(language, "RevisionSummary.tokensIn")} / ${metrics.usage.output ?? "—"} ${t(language, "RevisionSummary.out")}`
      : "";
  return (
    <p className="request-summary" role="status">
      <strong>{metrics.model}</strong> {verb} · {seconds} s · 1{" "}
      {t(language, "RevisionSummary.request")}
      {tokens}
    </p>
  );
}
