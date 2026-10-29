import { afterEach, describe, expect, it } from "vitest";
import { fingerprint, guideKey, isStale } from "./studio-cache";
import {
  clearStudio,
  loadStudio,
  restorePlayer,
  saveStudio,
  storageKey,
} from "./studio-store";
import { createLessonPlayer } from "./shared";
import type { Lesson, TryoutReply } from "./types";
import { coolingLesson } from "../../test-support/generated-lessons.mjs";

afterEach(() => localStorage.clear());
const lesson = () => coolingLesson() as unknown as Lesson;
const tryout = (): TryoutReply => ({
  chapters: [],
  overall: "Clear.",
  rating: 4,
  llm: {
    id: "meta:test",
    label: "Test",
    provider: "meta",
    model: "test",
    configured: true,
  },
  attemptsRemaining: 6,
});
const base = () => ({
  draft: lesson(),
  topic: "Cooling coffee",
  creation: "generated",
  reviewed: true,
  revisionPrompt: "Simplify.",
  compose: { at: 1000, key: "c" },
  revise: null,
  tryout: { reply: tryout(), at: 2000, key: fingerprint({ a: 1 }) },
  show: null,
  guide: {},
  explanations: { "0": "The gap shrinks." },
  player: null,
  presenting: false,
  pace: "fast" as const,
});

describe("fingerprint", () => {
  it("is stable across key order and changes with any value", () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(
      fingerprint({ b: [1, 2], a: 1 }),
    );
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
    expect(
      isStale({ reply: 1, at: 0, key: fingerprint("x") }, fingerprint("x")),
    ).toBe(false);
    expect(
      isStale({ reply: 1, at: 0, key: fingerprint("x") }, fingerprint("y")),
    ).toBe(true);
  });
  it("keys the explain-back on the learner's words and position", () => {
    const player = createLessonPlayer(lesson());
    const a = guideKey(player, "en", "because");
    expect(guideKey(player, "en", " because ")).toBe(a);
    expect(guideKey(player, "zh", "because")).not.toBe(a);
    player.predict("agree");
    expect(guideKey(player, "en", "because")).not.toBe(a);
  });
});

describe("studio store", () => {
  it("round-trips the draft, review state, cached results and pace", () => {
    saveStudio(base());
    const saved = loadStudio()!;
    expect(saved.draft.title.en).toBe("Cooling coffee");
    expect(saved.reviewed).toBe(true);
    expect(saved.revisionPrompt).toBe("Simplify.");
    expect(saved.tryout?.reply.overall).toBe("Clear.");
    expect(saved.tryout?.at).toBe(2000);
    expect(saved.compose).toEqual({ at: 1000, key: "c" });
    expect(saved.explanations).toEqual({ "0": "The gap shrinks." });
    expect(saved.pace).toBe("fast");
    clearStudio();
    expect(loadStudio()).toBeNull();
  });
  it("keeps session ids, codes and tokens out of storage even if a reply carried them", () => {
    const value = base();
    (value.tryout!.reply as unknown as Record<string, unknown>).sessionId =
      "s-123";
    (value.tryout!.reply as unknown as Record<string, unknown>).accessCode =
      "INVITE";
    (value.tryout!.reply as unknown as Record<string, unknown>).token = "t";
    saveStudio(value);
    const raw = localStorage.getItem(storageKey)!;
    expect(raw).not.toMatch(/s-123|INVITE|"token"/);
    expect(raw).toMatch(/"key":/);
  });
  it("ignores unknown versions and invalid lessons", () => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 2, draft: {} }));
    expect(loadStudio()).toBeNull();
    localStorage.setItem(
      storageKey,
      JSON.stringify({ version: 1, draft: { title: "no" } }),
    );
    expect(loadStudio()).toBeNull();
    localStorage.setItem(storageKey, "{broken");
    expect(loadStudio()).toBeNull();
  });
});

describe("restorePlayer", () => {
  it("rebuilds a saved position through the engine's own transitions", () => {
    const first = createLessonPlayer(lesson());
    first.input("initial", 90);
    first.predict("disagree");
    first.next();
    first.scrub(1);
    first.next();
    const restored = restorePlayer(lesson(), first.state);
    expect(restored.state.stage).toBe("explain");
    expect(restored.state.prediction).toBe("disagree");
    expect(restored.state.progress).toBe(1);
    expect(restored.state.controls).toEqual({ initial: 90 });
    expect(restored.experiment("en").inputs?.[0].value).toBe(90);
  });
  it("falls back to the start for a nonsense state", () => {
    const restored = restorePlayer(lesson(), {
      chapter: 9,
      stage: "transfer",
      prediction: null,
      variant: 0,
      progress: 0.5,
      transfer: null,
      controls: { nope: Number.NaN },
      metric: 0,
    });
    expect(restored.state.chapter).toBe(0);
  });
});
