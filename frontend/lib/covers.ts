import { useEffect, useSyncExternalStore } from "react";
import { listCovers } from "./library";
import type { CoverRecord } from "./library";

// Creator-drawn library covers, shared by the library and the Draw a cover tool: fetched
// once per page load, and updated in place when a creator draws one, so the library shows
// the new cover at once even though it stays mounted across lesson pages.
let covers: Record<string, CoverRecord> = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function loadCovers(): Promise<void> {
  if (!loading)
    loading = listCovers()
      .then((result) => {
        covers = result?.covers ?? {};
        emit();
      })
      .catch(() => {
        // A failed fetch leaves the shipped covers in place; the next page load retries.
        loading = null;
      });
  return loading;
}
export function applyCover(id: string, record: CoverRecord) {
  covers = { ...covers, [id]: record };
  emit();
}
export function useCovers(): Record<string, CoverRecord> {
  const current = useSyncExternalStore(
    subscribe,
    () => covers,
    () => covers,
  );
  useEffect(() => {
    void loadCovers();
  }, []);
  return current;
}
// Tests start from an empty store.
export function resetCovers() {
  covers = {};
  loading = null;
  emit();
}
