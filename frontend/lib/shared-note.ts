import { t } from "./messages";
import type { Language } from "./types";

// The one note every creator-shared lesson carries, with the creator's own review date
// when the saved content was reviewed. Used by the library card and the shared page.
export function sharedProvenanceText(
  item: { reviewedAt?: number | null },
  language: Language,
): string {
  if (!item.reviewedAt) return t(language, "Gallery.sharedProvenance");
  const date = new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
  }).format(item.reviewedAt);
  return t(language, "Gallery.sharedReviewedProvenance").replace(
    "{date}",
    date,
  );
}
