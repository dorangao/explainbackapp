import { t } from "../lib/messages";
import type { Language, LessonCurrency } from "../lib/types";

// The author's stable-or-dated mark on a generated lesson: a dated lesson names the day
// its figures were drafted, so a reader knows they may have changed since.
export function CurrencyNote({
  language,
  currency,
}: {
  language: Language;
  currency: LessonCurrency | null | undefined;
}) {
  if (!currency) return null;
  return (
    <p className="fine currency-note" data-status={currency.status}>
      {currency.status === "dated"
        ? t(language, "Lesson.figuresAsOf").replace("{date}", currency.asOf)
        : t(language, "Lesson.restsOnConstants")}
    </p>
  );
}
