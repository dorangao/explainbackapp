import { t } from "../lib/messages";
import type { Language } from "../lib/types";
import { formatCachedAt } from "../lib/studio-cache";

// A model-backed action's memory: when it last answered and whether its inputs changed.
export type CacheState = { at: number; stale: boolean } | null;
// Button text for a model-backed action: first run, explicit re-run, or send changes.
export function actionLabel(
  language: Language,
  base: string,
  cache: CacheState,
) {
  if (!cache) return base;
  return cache.stale
    ? t(language, "Cache.sendChangesToMuse")
    : t(language, "Cache.reRun");
}
export function CacheNote({
  cache,
  language,
}: {
  cache: CacheState;
  language: Language;
}) {
  if (!cache) return null;
  return (
    <p className="cache-note" data-stale={cache.stale} role="status">
      {cache.stale
        ? `${t(language, "Cache.changedSince")} ${formatCachedAt(cache.at, language)}.`
        : `${t(language, "Cache.cachedResult")} · ${t(language, "Cache.unchangedSince")} ${formatCachedAt(cache.at, language)}. ${t(language, "Cache.noRequestWasMade")}`}
    </p>
  );
}
