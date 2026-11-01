import { useCallback, useEffect, useRef, useState } from "react";
import type { Post, Target, Language, Usage } from "../lib/types";
import { ApiError } from "../lib/api";

export type StudioSession = { sessionId: string; attemptsRemaining: number };
export type RequestMetrics = {
  model: string;
  elapsedMs: number;
  usage: Usage | null;
  // The model's own one-line account of its reasoning, when it gave one. Unverified.
  reasoning?: string | null;
  mode:
    | "ground"
    | "compose"
    | "revise"
    | "guide"
    | "tryout"
    | "show"
    | "illustrate"
    | "cover"
    | "judge"
    | "detect"
    | "transcribe"
    | "compare";
  at: number;
};

// One provider session per Studio mount: creates it lazily, pins the creator's chosen
// model, invalidates pending replies (language change, model change, unmount) and keeps
// the attempt budget. Replies that arrive after an invalidation are discarded.
export function useProviderSession({
  post,
  language,
  sessionTarget,
  onBusy,
  onInvalidate,
  onSettled,
}: {
  post: Post;
  language: Language;
  // The model the session is created with: the creator's selection, which the server
  // uses for compose, revise and show. Each request still names its own target (the
  // tester role for ground, guide and tryout) for its timeout; the server picks the
  // tester model for those routes by mode, not by session. Without it, a session whose
  // first request was a tester call would draft with the tester model.
  sessionTarget?: Target | null;
  onBusy: (busy: boolean) => void;
  onInvalidate?: () => void;
  // Called after every request settles, success or failure, so the caller can refresh
  // what the request may have changed (the hourly budget shown in the header).
  onSettled?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    // Which request is in flight, so a button can say "working" only for its own call.
    [activeMode, setActiveMode] = useState<RequestMetrics["mode"] | null>(null),
    [remaining, setRemaining] = useState(8),
    [sessionId, setSessionId] = useState<string | null>(null),
    [metrics, setMetrics] = useState<RequestMetrics | null>(null);
  const session = useRef<StudioSession | null>(null),
    epoch = useRef(0),
    pending = useRef<AbortController | null>(null),
    alive = useRef(true),
    busyRef = useRef(false),
    postRef = useRef(post),
    sessionTargetRef = useRef(sessionTarget),
    languageRef = useRef(language),
    onInvalidateRef = useRef(onInvalidate),
    settledRef = useRef(onSettled);
  useEffect(() => {
    postRef.current = post;
    sessionTargetRef.current = sessionTarget;
    onInvalidateRef.current = onInvalidate;
    settledRef.current = onSettled;
  }, [post, sessionTarget, onInvalidate, onSettled]);
  const markBusy = useCallback(
    (value: boolean) => {
      busyRef.current = value;
      setBusy(value);
      onBusy(value);
    },
    [onBusy],
  );
  const invalidate = useCallback(
    (remote = true) => {
      epoch.current++;
      pending.current?.abort();
      pending.current = null;
      const old = session.current;
      session.current = null;
      setSessionId(null);
      setRemaining(8);
      setMetrics(null);
      markBusy(false);
      setActiveMode(null);
      onInvalidateRef.current?.();
      if (old && remote)
        void postRef
          .current("/api/reset", { sessionId: old.sessionId })
          .catch(() => {});
    },
    [markBusy],
  );
  useEffect(() => {
    alive.current = true;
    const epochRef = epoch,
      pendingRef = pending,
      sessionRef = session;
    return () => {
      alive.current = false;
      epochRef.current++;
      pendingRef.current?.abort();
      const old = sessionRef.current;
      if (old)
        void postRef
          .current("/api/reset", { sessionId: old.sessionId })
          .catch(() => {});
      onBusy(false);
    };
  }, [onBusy]);
  // A language change cannot be applied to a reply requested in the other language.
  const [languageInterrupted, setLanguageInterrupted] = useState(false);
  useEffect(() => {
    if (languageRef.current === language) return;
    languageRef.current = language;
    const wasBusy = busyRef.current;
    invalidate();
    setLanguageInterrupted(wasBusy);
  }, [language, invalidate]);
  const current = useCallback(
    (token: number) => alive.current && token === epoch.current,
    [],
  );
  // Runs one provider request; `fn` receives the session id and must return the reply.
  // `target` is the model this request runs on, which sets its timeout; the session
  // itself is created with `sessionTarget` when given.
  const run = useCallback(
    async <T extends { attemptsRemaining?: number }>(
      target: Target,
      mode: RequestMetrics["mode"],
      fn: (
        sessionId: string,
        options: { timeoutMs: number; signal: AbortSignal },
      ) => Promise<
        T & {
          usage?: RequestMetrics["usage"];
          model?: string;
          elapsedMs?: number;
          reasoning?: string | null;
        }
      >,
    ): Promise<
      { ok: true; reply: T } | { ok: false; error: unknown; stale: boolean }
    > => {
      const token = ++epoch.current,
        controller = new AbortController();
      pending.current = controller;
      markBusy(true);
      setActiveMode(mode);
      setLanguageInterrupted(false);
      const options = {
        timeoutMs: (target.timeoutMs ?? 60000) + 65000,
        signal: controller.signal,
      };
      const started = performance.now();
      try {
        if (!session.current) {
          const created = await postRef.current<StudioSession>(
            "/api/studio/session",
            {
              synthetic: true,
              language: languageRef.current,
              llm: (sessionTargetRef.current ?? target).id,
            },
            options,
          );
          if (!current(token)) {
            void postRef
              .current("/api/reset", { sessionId: created.sessionId })
              .catch(() => {});
            return { ok: false, error: null, stale: true };
          }
          session.current = created;
          setSessionId(created.sessionId);
        }
        const reply = await fn(session.current.sessionId, options);
        if (!current(token)) return { ok: false, error: null, stale: true };
        if (typeof reply.attemptsRemaining === "number")
          setRemaining(reply.attemptsRemaining);
        // The server measures the provider call itself; the client timing is the fallback.
        setMetrics({
          model: reply.model ?? target.model,
          elapsedMs: reply.elapsedMs ?? Math.round(performance.now() - started),
          usage: reply.usage ?? null,
          reasoning: reply.reasoning ?? null,
          mode,
          at: Date.now(),
        });
        return { ok: true, reply };
      } catch (error) {
        if (!current(token)) return { ok: false, error, stale: true };
        if (error instanceof ApiError) {
          if (error.status === 404) {
            session.current = null;
            setSessionId(null);
          }
          if (error.attemptsRemaining !== undefined)
            setRemaining(error.attemptsRemaining);
        }
        return { ok: false, error, stale: false };
      } finally {
        if (current(token)) {
          pending.current = null;
          markBusy(false);
          setActiveMode(null);
        }
        settledRef.current?.();
      }
    },
    [current, markBusy],
  );
  return {
    busy,
    activeMode,
    busyRef,
    remaining,
    sessionId,
    metrics,
    languageInterrupted,
    invalidate,
    run,
    alive,
    epoch,
  };
}
