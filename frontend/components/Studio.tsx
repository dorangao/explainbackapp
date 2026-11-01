import { t } from "../lib/messages";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ComposeReply,
  CoverReply,
  GroundReply,
  References,
  CompareDraft,
  CompareReply,
  Feedback,
  Language,
  Lesson,
  Player,
  Post,
  Status,
  TryoutReply,
  ShowReply,
  IllustrateReply,
  DetectReply,
} from "../lib/types";
import { say } from "../lib/types";
import { ApiError } from "../lib/api";
import {
  createLessonPlayer,
  galleryLesson,
  gallerySourceNote,
  evaluationLesson,
  evaluationComparison,
  evaluationModelLabel,
  evaluationNote,
  studioWalkthrough,
  validateLesson,
} from "../lib/shared";
import { blobToBase64 } from "../lib/recorder";
import { useProviderSession } from "../hooks/useProviderSession";
import { useImageAttachment } from "../hooks/useImageAttachment";
import { fingerprint, guideKey } from "../lib/studio-cache";
import type { Cached, Pace } from "../lib/studio-cache";
import {
  clearStudio,
  hasStoredStudio,
  loadStudio,
  restorePlayer,
  saveStudio,
} from "../lib/studio-store";
import type { CacheState } from "./CacheNote";
import { FeaturedLesson, Gallery } from "./Gallery";
import { LessonShelf, ShareControls } from "./Library";
import {
  cachesFromSaved,
  readMine,
  saveLesson as saveToShelf,
  shareLesson,
} from "../lib/library";
import { judgeBlocker, judgeStepStates } from "../lib/judge-path";
import { JudgePath } from "./JudgePath";
import { PageHeader } from "./PageHeader";
import type { JudgeStep, JudgeStepId } from "./JudgePath";
import type {
  SavedGrade,
  SavedLesson,
  SavedSummary,
  SavedTryout,
} from "../lib/library";
import { LessonPlayer } from "./LessonPlayer";
import { RequestSummary } from "./RequestSummary";
import { DraftReview } from "./DraftReview";
import { CoverTool } from "./CoverTool";
import { LiveComparison } from "./Comparison";
import { Spotlight } from "./Spotlight";
import { withoutUnits } from "../lib/units";
import { EVALUATION_CARD_HASH, reportLessonUrl } from "../lib/evaluation";
import { sharedProvenanceText } from "../lib/shared-note";
import { toDataUrl } from "../lib/image";
import type { Detection } from "./Spotlight";
import { RevisionSummary } from "./RevisionSummary";
const ShowPlayer = lazy(() =>
  import("./ShowPlayer").then((module) => ({ default: module.ShowPlayer })),
);
// Keep review and revision available to long-lived tabs even after a deployment.
const ProviderConsole = lazy(() =>
  import("./ProviderConsole").then((m) => ({ default: m.ProviderConsole })),
);

type Revision = { before: Lesson; after: Lesson };
type Stamp = { at: number; key: string };
const cacheState = (stamp: Stamp | null, key: string): CacheState =>
  stamp ? { at: stamp.at, stale: stamp.key !== key } : null;

export function Studio({
  language,
  authenticated,
  status: providerStatus,
  post,
  visible,
  view,
  lessonId,
  starter,
  onBusy,
  onRequestSettled,
  onRequestAccess,
  external = null,
}: {
  language: Language;
  authenticated: boolean;
  status: Status | null;
  post: Post;
  visible: boolean;
  view: "studio" | "create";
  lessonId: string | null;
  starter: number;
  onBusy: (busy: boolean) => void;
  // After any provider request settles; App refreshes the status (hourly budget).
  onRequestSettled?: () => void;
  onRequestAccess: () => void;
  // A shared lesson opened by link (`#shared:ID`): reviewed content from another creator.
  external?: SavedLesson | null;
}) {
  const formId = useId();
  const [topic, setTopic] = useState(""),
    [creation, setCreation] = useState("generated"),
    // Search first: Spark gathers sourced figures before the draft (one extra request);
    // the sheet travels with revisions and is remembered with the draft.
    [searchFirst, setSearchFirst] = useState(false),
    // Compare: let the rubric judge search the web and score factual currency (judge v2).
    [groundedJudge, setGroundedJudge] = useState(false),
    [references, setReferences] = useState<References | null>(null),
    [modelId, setModelId] = useState(""),
    [draft, setDraft] = useState<Lesson | null>(null),
    [revisionKey, setRevisionKey] = useState(0),
    [reviewed, setReviewed] = useState(false),
    [player, setPlayer] = useState<Player | null>(null),
    [presenting, setPresenting] = useState(false),
    [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [revision, setRevision] = useState<Revision | null>(null),
    // Model results are kept with the inputs they answered; see studio-cache.ts.
    [tryout, setTryout] = useState<Cached<TryoutReply> | null>(null),
    [show, setShow] = useState<Cached<ShowReply> | null>(null),
    [guide, setGuide] = useState<Record<string, Cached<Feedback>>>({}),
    [explanations, setExplanations] = useState<Record<string, string>>({}),
    [composeStamp, setComposeStamp] = useState<Stamp | null>(null),
    [reviseStamp, setReviseStamp] = useState<Stamp | null>(null),
    [revisionPrompt, setRevisionPrompt] = useState(""),
    [pace, setPace] = useState<Pace>("off"),
    [playerTick, setPlayerTick] = useState(0),
    [showing, setShowing] = useState(false),
    [backgroundRunning, setBackgroundRunning] = useState(false),
    // Both models' replies to the typed question, until one is chosen or discarded.
    [comparison, setComparison] = useState<CompareReply | null>(null),
    // Which of the two compared models judges the drafts; the tester role until changed.
    [judgeId, setJudgeId] = useState<string | null>(null),
    [source, setSource] = useState<string | null>(null),
    [sourceImage, setSourceImage] = useState<string | null>(null),
    // What SAM 3.1 found in the source image, kept with the image it was found in.
    [detection, setDetection] = useState<
      (Detection & { image: string }) | null
    >(null),
    // The saved copy on the creator's shelf, when this draft has one.
    [savedId, setSavedId] = useState<string | null>(null),
    [savedItem, setSavedItem] = useState<SavedSummary | null>(null),
    [saving, setSaving] = useState(false),
    [shelfRefresh, setShelfRefresh] = useState(0),
    // The judge path is running one or more steps in sequence.
    [judgeRunning, setJudgeRunning] = useState(false);
  const clearFeedback = useCallback(() => setFeedback(null), []);
  const provider = useProviderSession({
    post,
    language,
    onBusy,
    onInvalidate: clearFeedback,
    onSettled: onRequestSettled,
  });
  const {
    busy,
    busyRef,
    remaining,
    sessionId,
    metrics,
    languageInterrupted,
    run,
    alive,
    epoch,
  } = provider;
  const image = useImageAttachment(language);
  const playerState = useRef<Player["state"] | null>(null);
  const onPlayerState = useCallback((state: Player["state"]) => {
    playerState.current = state;
    setPlayerTick((n) => n + 1);
  }, []);
  const targets = useMemo(
    () => providerStatus?.models ?? [],
    [providerStatus?.models],
  );
  // The creator role (Wonder when configured) is the initial choice; the tester role is fixed.
  const target =
    targets.find((m) => m.id === modelId) ??
    targets.find(
      (m) => m.id === providerStatus?.roles?.creator && m.configured,
    ) ??
    targets.find((m) => m.id === providerStatus?.defaultModel) ??
    targets[0];
  const tester =
    targets.find((m) => m.id === providerStatus?.roles?.tester) ?? null;
  // Comparing needs both roles configured and different (Wonder and Spark).
  const creatorRole =
    targets.find((m) => m.id === providerStatus?.roles?.creator) ?? null;
  const canCompare = Boolean(
    creatorRole?.configured &&
    tester?.configured &&
    creatorRole.id !== tester.id,
  );
  const judgeOptions =
    canCompare && creatorRole && tester ? [creatorRole, tester] : [];
  const judge = judgeOptions.find((m) => m.id === judgeId) ?? tester;
  const { invalidate } = provider;
  const stopHidden = (!visible || (!lessonId && view === "studio")) && busy;
  useEffect(() => {
    if (!stopHidden) return;
    invalidate();
    setMessage(t(language, "Studio.requestStoppedHereYourCurrent"));
  }, [stopHidden, invalidate, language]);
  const loadLesson = useCallback((input: unknown) => {
    const valid = validateLesson(input);
    setDraft(valid);
    setPlayer(null);
    setPresenting(false);
    setReviewed(false);
    setSource(null);
    setFeedback(null);
    setShowing(false);
    setRevisionKey((k) => k + 1);
    setMessage("");
    return valid;
  }, []);
  const closeLesson = useCallback(() => {
    invalidate();
    setDraft(null);
    setPlayer(null);
    setPresenting(false);
    setReviewed(false);
    setSource(null);
    setFeedback(null);
    setRevision(null);
    setReferences(null);
    setTryout(null);
    setShow(null);
    setGuide({});
    setExplanations({});
    setComposeStamp(null);
    setReviseStamp(null);
    setRevisionPrompt("");
    setShowing(false);
    setMessage("");
    setSavedId(null);
    setSavedItem(null);
    playerState.current = null;
    clearStudio();
  }, [invalidate]);
  // The last lesson is remembered in this browser: restore it once access is confirmed,
  // without any provider request. Gallery instances (lessonId) never restore.
  const restored = useRef(false);
  useEffect(() => {
    if (!authenticated || lessonId || restored.current) return;
    restored.current = true;
    const saved = loadStudio();
    if (!saved) return;
    setDraft(saved.draft);
    setTopic(saved.topic);
    setCreation(saved.creation);
    setReviewed(saved.reviewed);
    setRevisionPrompt(saved.revisionPrompt);
    setComposeStamp(saved.compose);
    setReviseStamp(saved.revise);
    setTryout(saved.tryout);
    setShow(saved.show);
    setGuide(saved.guide);
    setExplanations(saved.explanations);
    setPace(saved.pace);
    setSavedId(saved.savedId);
    setReferences(saved.references ?? null);
    setRevisionKey((k) => k + 1);
    if (saved.presenting) {
      setPlayer(restorePlayer(saved.draft, saved.player));
      setPresenting(true);
    }
    setMessage(t(language, "Studio.restoredYourLastLesson"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the message language is read once at restore
  }, [authenticated, lessonId]);
  useEffect(() => {
    if (!authenticated || lessonId || !draft) return;
    const timer = window.setTimeout(
      () =>
        saveStudio({
          draft,
          topic,
          creation,
          reviewed,
          revisionPrompt,
          compose: composeStamp,
          revise: reviseStamp,
          tryout,
          show,
          guide,
          explanations,
          player: presenting ? playerState.current : null,
          presenting,
          pace,
          savedId,
          references,
        }),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [
    authenticated,
    lessonId,
    draft,
    topic,
    creation,
    reviewed,
    revisionPrompt,
    composeStamp,
    reviseStamp,
    tryout,
    show,
    guide,
    explanations,
    presenting,
    pace,
    playerTick,
    savedId,
    references,
  ]);
  // The share controls need the saved copy's summary; a restored draft fetches it once.
  useEffect(() => {
    if (!authenticated || !savedId || savedItem?.id === savedId) return;
    let live = true;
    void readMine(savedId)
      .then((record) => {
        if (!live) return;
        const { lesson: _lesson, show: _show, ...summary } = record;
        setSavedItem(summary);
      })
      .catch(() => {
        if (live) setSavedId(null);
      });
    return () => {
      live = false;
    };
  }, [authenticated, savedId, savedItem?.id]);
  // A gallery lesson is reviewed content: open it straight into the player.
  const openedGallery = useRef<string | null>(null);
  const evaluationItem = lessonId ? evaluationLesson(lessonId) : null;
  useEffect(() => {
    if (!lessonId || openedGallery.current === lessonId) return;
    const item = external
      ? { lesson: external.lesson, source: "shared", image: undefined }
      : galleryLesson(lessonId);
    if (!item) return;
    openedGallery.current = lessonId;
    invalidate();
    const lesson = loadLesson(structuredClone(item.lesson));
    setReviewed(true);
    setPlayer(createLessonPlayer(lesson));
    setPresenting(true);
    setSource(item.source);
    setSourceImage(item.image ?? null);
    // A shared lesson keeps its "shared" note; its sketch only feeds the Spotlight.
    if (external?.sketch) setSourceImage(external.sketch);
    if (external) restoreRef.current(lesson, external, external.updatedAt);
    if (external?.show)
      setShow({
        reply: {
          show: external.show,
          cover: external.cover,
          coverModel: external.coverModel,
          illustrations: external.illustrations,
          model: external.model ?? undefined,
        } as ShowReply,
        at: external.updatedAt,
        key: fingerprint({ lesson: withoutUnits(lesson) }),
      });
  }, [lessonId, external, invalidate, loadLesson]);
  // An invite or the Create link seeds the editable starter topic.
  const seenStarter = useRef(0);
  useEffect(() => {
    if (!starter || !authenticated || seenStarter.current === starter) return;
    seenStarter.current = starter;
    if (!draftRef.current && !hasStoredStudio()) {
      closeLesson();
      setTopic(studioWalkthrough(language).topic);
      setCreation("generated");
    }
  }, [starter, authenticated, closeLesson, language]);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The latest show, updated the moment a reply arrives as well as on render, so a step
  // that runs right after another (the judge path) never reads a show from before it.
  const showRef = useRef(show);
  showRef.current = show;
  // What went wrong, in words the person can act on. The server's own sentence is used
  // when it names a condition (budget used up, session reset, model not configured,
  // sign-in needed, request too large); otherwise the generic line, plus the server's
  // rejection reason when it sent one.
  const failureMessage = (error: unknown) => {
    if (error instanceof ApiError) {
      const key = (
        {
          401: "Studio.failSignIn",
          409: "Studio.failConflict",
          413: "Studio.failTooLarge",
          429: "Studio.failBudget",
          503: "Studio.failNotConfigured",
        } as const
      )[error.status as 401 | 409 | 413 | 429 | 503];
      if (key) return t(language, key);
    }
    if (
      error instanceof Error &&
      error.message === "Background lesson is still running."
    )
      return t(language, "Studio.backgroundStillRunning");
    return (
      t(language, "Studio.theRequestCouldNotBe") +
      (error instanceof ApiError && error.reason
        ? `\n${t(language, "Studio.reason")}: ${error.reason}`
        : "")
    );
  };
  // `text` is the revision request for compose, or the learner's own explanation for guide.
  // `starter` replaces the typed topic for a scripted compose (the judge path).
  async function request(
    mode: "compose" | "guide",
    text?: string,
    starterTopic?: string,
  ) {
    const revisionText = mode === "compose" ? text : undefined,
      learnerText = mode === "guide" ? text?.trim() : undefined,
      asked = (starterTopic ?? topic).trim();
    if (
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      remaining === 0 ||
      image.loading
    )
      return false;
    const attached = image.image;
    if (mode === "compose" && !revisionText && !asked && !attached) {
      setMessage(t(language, "Studio.enterAQuestionOrAttach"));
      return false;
    }
    if (attached && !revisionText && target.provider !== "meta") {
      setMessage(t(language, "Studio.chooseAMetaModelFor"));
      return false;
    }
    // The sheet a new grounded draft is written from, or the one a revision keeps.
    let sheet: References | null =
      mode === "compose" && revisionText ? references : null;
    if (
      mode === "compose" &&
      !revisionText &&
      searchFirst &&
      creation === "generated" &&
      asked
    ) {
      const grounded = await run<GroundReply>(
        tester ?? target,
        "ground",
        (id, options) =>
          post<GroundReply>(
            "/api/studio/ground",
            { sessionId: id, topic: asked },
            options,
          ),
      );
      if (!grounded.ok) {
        if (!grounded.stale) setMessage(failureMessage(grounded.error));
        return false;
      }
      sheet =
        grounded.reply.status === "ready" && grounded.reply.facts.length > 0
          ? { asOf: grounded.reply.asOf, facts: grounded.reply.facts }
          : null;
      if (!sheet) setMessage(grounded.reply.note[language]);
    }
    const forAuthor = (value: References | null) =>
      value && creation === "generated"
        ? {
            references: {
              asOf: value.asOf,
              facts: value.facts.map(
                ({ statement, value: v, unit, url, title }) => ({
                  statement,
                  value: v,
                  unit,
                  url,
                  title,
                }),
              ),
            },
          }
        : {};
    let body: Record<string, unknown>;
    try {
      body =
        mode === "compose"
          ? {
              topic:
                asked ||
                (!revisionText && attached
                  ? ""
                  : (draft?.title[language] ?? "")),
              creation,
              ...forAuthor(sheet),
              ...(!revisionText && attached ? { image: attached.dataUrl } : {}),
              ...(revisionText
                ? {
                    draft: validateLesson(draft ? withoutUnits(draft) : draft),
                    revision: revisionText,
                  }
                : {}),
            }
          : {
              lesson: validateLesson(player?.lesson),
              chapter: player!.state.chapter,
              variant: player!.state.variant,
              prediction: player!.state.prediction,
              language,
              controls: player!.state.controls,
              metric: player!.state.metric,
              ...(learnerText ? { explanation: learnerText } : {}),
            };
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return false;
    }
    const before = revisionText && draft ? structuredClone(draft) : null;
    const requestKey =
      mode === "guide" && player
        ? guideKey(player, language, learnerText)
        : revisionText
          ? ""
          : composeKey;
    const chapterKey = String(player?.state.chapter ?? 0);
    setMessage("");
    setFeedback(null);
    const background =
      mode === "compose" &&
      target.provider === "meta" &&
      target.model.startsWith("muse-wonder");
    let acknowledged = false;
    if (background) setBackgroundRunning(true);
    const result = await run<ComposeReply | Feedback>(
      mode === "guide" ? (tester ?? target) : target,
      mode === "guide" ? "guide" : revisionText ? "revise" : "compose",
      async (id, options) => {
        let reply = await post<
          | ComposeReply
          | Feedback
          | { pending: true; attemptsRemaining?: number }
        >(
          `/api/studio/${mode}`,
          {
            sessionId: id,
            ...body,
            ...(background ? { background: true } : {}),
          },
          options,
        );
        acknowledged = "pending" in reply && reply.pending;
        const deadline = Date.now() + 10 * 60_000;
        let retrievalFailures = 0;
        while ("pending" in reply && reply.pending) {
          if (Date.now() >= deadline)
            throw new Error("Background lesson is still running.");
          try {
            reply = await post<
              | ComposeReply
              | Feedback
              | { pending: true; attemptsRemaining?: number }
            >(
              "/api/studio/poll",
              { sessionId: id },
              { ...options, timeoutMs: 20_000 },
            );
            retrievalFailures = 0;
          } catch (error) {
            if (
              options.signal.aborted ||
              !(error instanceof ApiError) ||
              error.status !== 502 ||
              error.code === "BACKGROUND_FAILED" ||
              ++retrievalFailures >= 3
            )
              throw error;
          }
          if ("pending" in reply && reply.pending)
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(() => {
                options.signal.removeEventListener("abort", abort);
                resolve();
              }, 2000);
              const abort = () => {
                window.clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
              };
              if (options.signal.aborted) abort();
              else
                options.signal.addEventListener("abort", abort, { once: true });
            });
        }
        return reply as ComposeReply | Feedback;
      },
    );
    if (background) setBackgroundRunning(false);
    if (!result.ok) {
      if (!result.stale) {
        if (acknowledged) invalidate();
        setMessage(
          failureMessage(result.error) +
            (acknowledged &&
            !(
              result.error instanceof ApiError &&
              result.error.code === "BACKGROUND_FAILED"
            )
              ? say(
                  language,
                  " The background result could not be recovered; a new retry may use another request.",
                  " 后台结果无法恢复；重新尝试可能会使用一次新请求。",
                )
              : ""),
        );
      }
      return false;
    }
    if (mode === "compose") {
      const composed = result.reply as ComposeReply;
      if (composed.status === "ready" && composed.lesson) {
        // A revision rewrites content; the creator's default unit system stays with the lesson.
        const next = loadLesson(
          before?.units
            ? { ...composed.lesson, units: before.units }
            : composed.lesson,
        );
        setRevision(before ? { before, after: next } : null);
        if (before)
          setReviseStamp({
            at: Date.now(),
            key: fingerprint({
              draft: withoutUnits(next),
              revision: revisionText?.trim(),
            }),
          });
        else setComposeStamp({ at: Date.now(), key: requestKey });
        if (!before) setReferences(sheet);
        setMessage(
          say(
            language,
            before
              ? "Revision ready. Check what changed, then review before presenting."
              : "Draft ready. Review the model and assumptions before presenting.",
            before
              ? "修改已就绪。先查看改动，再审阅后演示。"
              : "草稿已就绪，演示前请审阅模型与假设。",
          ) +
            (!before && sheet
              ? ` ${t(
                  language,
                  sheet.facts.length === 1
                    ? "Studio.groundedOnOne"
                    : "Studio.groundedOn",
                )
                  .replace("{n}", String(sheet.facts.length))
                  .replace("{date}", sheet.asOf)}`
              : "") +
            (composed.message?.[language]
              ? `\n${composed.message[language]}`
              : ""),
        );
        if (!revisionText) {
          if (attached) {
            // "studio-sketch": drafted here from the creator's own image. The gallery's
            // "muse-sketch" lessons carry a different, dated provenance note.
            setSource("studio-sketch");
            setSourceImage(attached.dataUrl);
          }
          image.clear();
        }
      } else setMessage(composed.message[language]);
    } else {
      const reply = result.reply as Feedback;
      setFeedback(reply);
      setGuide((g) => ({
        ...g,
        [chapterKey]: { reply, at: Date.now(), key: requestKey },
      }));
    }
    return true;
  }
  // The same question goes to both Muse text models at once; the app checks both replies
  // and the chosen judge (Spark unless the creator picks Wonder) scores the ready ones.
  // The creator then picks a draft to review.
  async function compareModels() {
    const asked = topic.trim();
    if (
      busyRef.current ||
      !authenticated ||
      !canCompare ||
      !creatorRole ||
      remaining === 0 ||
      image.loading
    )
      return false;
    if (!asked) {
      setMessage(t(language, "Studio.enterAQuestionOrAttach"));
      return false;
    }
    setMessage("");
    setFeedback(null);
    const result = await run<CompareReply>(
      creatorRole,
      "compare",
      (id, options) =>
        post<CompareReply>(
          "/api/studio/compare",
          {
            sessionId: id,
            topic: asked,
            judge: judge?.id,
            ...(groundedJudge ? { grounded: true } : {}),
          },
          { ...options, timeoutMs: options.timeoutMs + 60_000 },
        ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return false;
    }
    setComparison(result.reply);
    setMessage(t(language, "Studio.comparisonReady"));
    return true;
  }
  // The chosen reply becomes the draft, exactly as a single Create would have.
  function useComparedDraft(chosen: CompareDraft) {
    if (!chosen.lesson) return;
    try {
      loadLesson(structuredClone(chosen.lesson));
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return;
    }
    setRevision(null);
    setComposeStamp({ at: Date.now(), key: composeKey });
    setComparison(null);
    image.clear();
    setMessage(
      say(
        language,
        `Draft from ${chosen.model} ready. Review the model and assumptions before presenting.`,
        `来自 ${chosen.model} 的草稿已就绪，演示前请审阅模型与假设。`,
      ),
    );
  }
  // A library cover for the open reviewed lesson, drawn by Muse Image: one image request.
  async function drawCover(): Promise<CoverReply | null> {
    if (
      !lessonId ||
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      remaining === 0
    )
      return null;
    const result = await run<CoverReply>(target, "cover", (id, options) =>
      post<CoverReply>(
        "/api/studio/cover",
        { sessionId: id, lessonId },
        { ...options, timeoutMs: options.timeoutMs + 60_000 },
      ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return null;
    }
    return result.reply;
  }
  // The test learner (tester role) tries the validated draft; its answers are checked by code.
  async function tryLesson() {
    if (
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      remaining === 0 ||
      !draft
    )
      return false;
    let lesson: Lesson;
    try {
      lesson = validateLesson(draft);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return false;
    }
    setMessage("");
    const result = await run<TryoutReply>(
      tester ?? target,
      "tryout",
      (id, options) =>
        post<TryoutReply>(
          "/api/studio/tryout",
          { sessionId: id, lesson, language },
          options,
        ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return false;
    }
    setTryout({ reply: result.reply, at: Date.now(), key: tryoutKey });
    setMessage(t(language, "Studio.theTestLearnerTriedThis"));
    return true;
  }
  // The creator writes the narration; the server adds a Muse Image cover when it can.
  // The spoken explain-back: the recorded WAV goes to Muse Voice Transcribe and the
  // transcript comes back for the learner to edit; it is one request on the budget.
  async function transcribe(wav: Blob): Promise<string | null> {
    if (busyRef.current || !authenticated || !target?.configured) return null;
    const audio = await blobToBase64(wav);
    const result = await run<{ text: string; attemptsRemaining?: number }>(
      target,
      "transcribe",
      (id, options) =>
        post<{
          text: string;
          model: string;
          elapsedMs: number;
          usage: null;
          attemptsRemaining: number;
        }>(
          "/api/studio/transcribe",
          { sessionId: id, language, audio },
          { ...options, timeoutMs: 45_000 },
        ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return null;
    }
    return result.reply.text;
  }
  async function makeShow() {
    if (
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      remaining === 0 ||
      !draft
    )
      return false;
    let lesson: Lesson;
    try {
      lesson = validateLesson(draft);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return false;
    }
    setMessage("");
    const result = await run<ShowReply>(target, "show", (id, options) =>
      post<ShowReply>("/api/studio/show", { sessionId: id, lesson }, options),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return false;
    }
    const next = { reply: result.reply, at: Date.now(), key: showKey };
    showRef.current = next;
    setShow(next);
    setShowing(true);
    setMessage(
      t(
        language,
        result.reply.coverSkipped
          ? "Studio.theShowIsReadyNoCover"
          : "Studio.theShowIsReady",
      ),
    );
    return true;
  }
  // One SAM 3.1 request: find the thing the creator names in the source image.
  async function detect(concept: string) {
    if (
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      !sourceImage
    )
      return;
    const image = sourceImage;
    setMessage("");
    let bytes: string;
    try {
      bytes = await toDataUrl(image);
    } catch {
      setMessage(t(language, "Studio.couldNotReadImage"));
      return;
    }
    const result = await run<DetectReply>(target, "detect", (id, options) =>
      post<DetectReply>(
        "/api/studio/detect",
        { sessionId: id, image: bytes, concept },
        { ...options, timeoutMs: 45_000 },
      ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return;
    }
    const { concept: found, boxes, width, height, model } = result.reply;
    setDetection({
      concept: found,
      boxes,
      width,
      height,
      model: model ?? "sam-3.1",
      image,
    });
    setMessage(t(language, "Studio.foundInImage"));
  }
  // One Muse Image request for a slide of the current show, or a redrawn cover. The
  // server builds the prompt from the checked script; the creator may add a short note.
  async function illustrate(slide: number | null, direction = "") {
    if (
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      remaining === 0 ||
      !draft ||
      !show
    )
      return false;
    let lesson: Lesson;
    try {
      lesson = validateLesson(draft);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return false;
    }
    const script = show.reply.show;
    setMessage("");
    const result = await run<IllustrateReply>(
      target,
      "illustrate",
      (id, options) =>
        post<IllustrateReply>(
          "/api/studio/illustrate",
          { sessionId: id, lesson, show: script, slide, direction },
          options,
        ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return false;
    }
    const drawn = result.reply;
    const withImage = (prev: Cached<ShowReply> | null) =>
      prev && prev.reply.show === script
        ? {
            ...prev,
            reply:
              drawn.slide === null
                ? {
                    ...prev.reply,
                    cover: drawn.image,
                    coverModel: drawn.model ?? "muse-image-1.0",
                  }
                : {
                    ...prev.reply,
                    illustrations: {
                      ...prev.reply.illustrations,
                      [String(drawn.slide)]: drawn.image,
                    },
                  },
          }
        : prev;
    showRef.current = withImage(showRef.current);
    setShow(withImage);
    setMessage(t(language, "Studio.illustrationReady"));
    return true;
  }
  // The shared-lesson effect above runs once per lesson and calls the latest copy.
  const restoreRef = useRef(restoreResults);
  restoreRef.current = restoreResults;
  // Puts a saved tryout report and explain-back grades back into the caches. Keys are
  // the ones the caches use, so each result shows as fresh or stale against the live
  // lesson state exactly as before; no model request is made.
  function restoreResults(
    lesson: Lesson,
    record: { tryout: SavedTryout | null; grades: Record<string, SavedGrade> },
    at: number,
  ) {
    const caches = cachesFromSaved(lesson, record, at, target ?? null);
    setTryout(caches.tryout);
    setGuide(caches.guides);
    setExplanations(caches.texts);
  }
  // Shares the saved copy by link from the judge path; the shelf has the same switch.
  async function shareSaved(): Promise<boolean> {
    if (!savedId || !savedItem) return false;
    try {
      const next = await shareLesson(post, savedId, true);
      if (!alive.current) return false;
      setSavedItem(next);
      setShelfRefresh((n) => n + 1);
      setMessage(t(language, "Library.linkTurnedOn"));
      return true;
    } catch (e) {
      if (alive.current)
        setMessage(
          e instanceof ApiError
            ? e.message
            : t(language, "Library.couldNotUpdate"),
        );
      return false;
    }
  }
  // The six-step reviewer tour. Each step is the same action as its button elsewhere
  // on the page, so caches, budgets and messages behave identically.
  const judgeActions: Record<JudgeStepId, () => Promise<boolean>> = {
    draft: () => {
      const seed = studioWalkthrough(language).topic;
      setTopic(seed);
      return request("compose", undefined, seed);
    },
    tryout: () => tryLesson(),
    show: () => makeShow(),
    // Prefer the slide the writer flagged but the show had no time to draw; otherwise the
    // first slide that can carry a picture and has none yet.
    illustrate: async () => {
      const current = showRef.current;
      if (!current) return false;
      const slides = current.reply.show.slides,
        drawn = current.reply.illustrations ?? {};
      const open = (want: (s: (typeof slides)[number]) => boolean) =>
        slides.findIndex((s, i) => i > 0 && !drawn[String(i)] && want(s));
      const flagged = open((s) => s.illustrate === true),
        plain = open((s) => s.kind !== "experiment" && s.kind !== "evidence");
      return illustrate(flagged > 0 ? flagged : plain > 0 ? plain : 1);
    },
    save: () => saveLesson(),
    share: () => shareSaved(),
  };
  // The actions close over the current render; a sequence must call the latest copy
  // after each step so the next one sees the previous result.
  const judgeActionsRef = useRef(judgeActions);
  judgeActionsRef.current = judgeActions;
  async function runJudgeStep(id: JudgeStepId) {
    if (judgeRunning) return;
    setJudgeRunning(true);
    try {
      await judgeActionsRef.current[id]();
    } finally {
      if (alive.current) setJudgeRunning(false);
    }
  }
  async function runJudgeAll() {
    if (judgeRunning) return;
    setJudgeRunning(true);
    try {
      for (let guard = 0; guard < 8; guard++) {
        const step = judgeStepsRef.current.find((s) => s.state === "todo");
        if (!step) break;
        if (!(await judgeActionsRef.current[step.id]())) break;
        if (!alive.current) return;
        // Let React render the new state before the next step reads it.
        await new Promise<void>((r) => setTimeout(r, 20));
      }
    } finally {
      if (alive.current) setJudgeRunning(false);
    }
  }
  async function importLesson(file: File | undefined) {
    if (!file || busyRef.current || !authenticated) return;
    const token = epoch.current;
    try {
      if (file.size > 40000) throw new Error();
      const value = JSON.parse(await file.text());
      if (alive.current && token === epoch.current && !busyRef.current) {
        loadLesson(value);
        setRevision(null);
        setMessage(t(language, "Studio.importedDraftReviewItBefore"));
      }
    } catch {
      if (alive.current && token === epoch.current)
        setMessage(t(language, "Studio.useAValidVersion1"));
    }
  }
  function exportLesson() {
    try {
      const valid = validateLesson(draft),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(valid, null, 2)], {
            type: "application/json",
          }),
        ),
        link = document.createElement("a");
      link.href = url;
      link.download = "explainback-lesson.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesBeforeExporting"));
    }
  }
  // Keeps the lesson (and its show script) on the creator's shelf; no model request.
  async function saveLesson() {
    if (!authenticated || saving || busyRef.current) return false;
    let valid: Lesson;
    try {
      valid = validateLesson(draft);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesBeforeExporting"));
      return false;
    }
    setSaving(true);
    try {
      const current =
        show?.key === fingerprint({ lesson: withoutUnits(valid) })
          ? show.reply
          : null;
      const hadImages = Boolean(
        current?.cover ||
        Object.keys(current?.illustrations ?? {}).length ||
        sourceImage,
      );
      const summary = await saveToShelf(post, {
        ...(savedId ? { id: savedId } : {}),
        lesson: valid,
        show: current?.show ?? null,
        // The drafting model, never the image or voice model of a later request.
        model:
          (metrics && !["illustrate", "transcribe"].includes(metrics.mode)
            ? metrics.model
            : null) ??
          show?.reply.model ??
          target?.model ??
          null,
        cover: current?.cover ?? null,
        coverModel: current?.coverModel ?? null,
        illustrations: current?.illustrations ?? null,
        sketch: source === "studio-sketch" ? sourceImage : null,
        reviewed,
        tryout:
          tryout && tryout.key === tryoutKey
            ? {
                chapters: tryout.reply.chapters,
                overall: tryout.reply.overall,
                rating: tryout.reply.rating,
                model: tryout.reply.model ?? null,
                language,
              }
            : null,
        grades: Object.fromEntries(
          Object.entries(guide)
            .filter(([, g]) => g.reply.verdict)
            .map(([k, g]) => [
              k,
              {
                explanation: explanations[k] ?? "",
                feedback: g.reply.explanation,
                verdict: g.reply.verdict as SavedGrade["verdict"],
                followUp: g.reply.followUp ?? null,
                model: g.reply.model ?? null,
                language,
                key: g.key,
              },
            ])
            .filter(([, g]) => (g as SavedGrade).explanation.trim()),
        ),
      });
      if (!alive.current) return false;
      setSavedId(summary.id);
      setSavedItem(summary);
      setShelfRefresh((n) => n + 1);
      // Images in the browser now point at their stored copies, so a later save
      // uploads nothing again and the draft in this browser stays small.
      if (current && summary.cover && summary.cover !== current.cover)
        setShow((prev) =>
          prev
            ? { ...prev, reply: { ...prev.reply, cover: summary.cover } }
            : prev,
        );
      if (summary.sketch && summary.sketch !== sourceImage)
        setSourceImage(summary.sketch);
      setMessage(
        t(language, savedId ? "Library.savedUpdated" : "Library.savedNotice") +
          (hadImages && !providerStatus?.imageStorage
            ? " " + t(language, "Library.imagesNotKept")
            : ""),
      );
    } catch (e) {
      if (alive.current)
        setMessage(
          e instanceof ApiError
            ? e.message
            : t(language, "Library.couldNotSave"),
        );
      return false;
    } finally {
      if (alive.current) setSaving(false);
    }
    return true;
  }
  function openSaved(record: SavedLesson) {
    const { lesson: body, show: script, ...summary } = record;
    const lesson = loadLesson(body);
    setReviewed(Boolean(summary.reviewedAt));
    setRevision(null);
    restoreResults(lesson, record, summary.updatedAt);
    setComposeStamp(null);
    setReviseStamp(null);
    setSavedId(summary.id);
    setSavedItem(summary);
    setSource(summary.sketch ? "studio-sketch" : null);
    setSourceImage(summary.sketch);
    setShow(
      script
        ? {
            reply: {
              show: script,
              cover: summary.cover,
              coverModel: summary.coverModel,
              illustrations: summary.illustrations,
              model: summary.model ?? undefined,
            } as ShowReply,
            at: summary.updatedAt,
            key: fingerprint({ lesson: withoutUnits(lesson) }),
          }
        : null,
    );
    setMessage(t(language, "Library.openedSaved"));
  }
  function present() {
    try {
      setPlayer(createLessonPlayer(validateLesson(draft)));
      setPresenting(true);
      setMessage("");
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndCheck"));
    }
  }
  const canRequest =
    authenticated && Boolean(target?.configured) && remaining > 0;
  // What each model-backed action depends on; a cached result is current while its key holds.
  const composeKey = fingerprint({
      topic: topic.trim(),
      creation,
      image: image.image ? fingerprint(image.image.dataUrl) : null,
    }),
    cacheDraft = draft && withoutUnits(draft),
    tryoutKey = fingerprint({ lesson: cacheDraft, language }),
    showKey = fingerprint({ lesson: cacheDraft }),
    reviseKey = fingerprint({
      draft: cacheDraft,
      revision: revisionPrompt.trim(),
    });
  const judgeSteps: JudgeStep[] = judgeStepStates({
    hasDraft: Boolean(draft),
    tryoutFresh: tryout?.key === tryoutKey,
    showFresh: show?.key === showKey,
    illustrated: Object.keys(show?.reply.illustrations ?? {}).length > 0,
    imagesAvailable: Boolean(providerStatus?.images),
    saved: Boolean(savedId && savedItem),
    shared: Boolean(savedItem?.shared),
  });
  const judgeStepsRef = useRef(judgeSteps);
  judgeStepsRef.current = judgeSteps;
  const caches = {
    compose: cacheState(composeStamp, composeStamp?.key ?? ""),
    revise: cacheState(reviseStamp, reviseKey),
    tryout: cacheState(tryout, tryoutKey),
    show: cacheState(show, showKey),
  };
  const showLesson = Boolean(lessonId) || view === "create";
  const statusMessage = languageInterrupted
    ? t(language, "Studio.languageChangedThePendingResult")
    : message || image.notice;
  const loadingNote = <p role="status">{t(language, "Studio.loading")}</p>;
  return (
    <div className="studio" hidden={!visible}>
      {draft && authenticated && showLesson && (
        <div className="draft-provider-bar">
          <label>
            {t(language, "Studio.creatorModel")}
            <select
              value={target?.id ?? ""}
              disabled={busy}
              onChange={(event) => {
                setModelId(event.target.value);
                invalidate();
              }}
            >
              {targets.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.configured}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {tester && (
            <p className="fine">
              {t(language, "Studio.testLearner")}: {tester.label}
            </p>
          )}
          <p className="fine">
            {remaining} {t(language, "Studio.requestsLeftInThisProvider")}
          </p>
          {savedItem && !lessonId && (
            <div className="saved-bar">
              <span className="saved-flag">
                ✓ {t(language, "Library.savedCopy")}
              </span>
              <ShareControls
                language={language}
                post={post}
                item={savedItem}
                busy={busy || saving}
                onChange={setSavedItem}
                onNotice={setMessage}
              />
            </div>
          )}
        </div>
      )}

      {!lessonId && view === "studio" && (
        <>
          <section className="intro-studio">
            <div>
              <p className="eyebrow">
                {t(language, "Studio.curiosityPutIntoPractice")}
              </p>
              <h1>
                {t(language, "Studio.aQuestionAnExperiment")}
                <br />
                <span>{t(language, "Studio.yourOwnExplanation")}</span>
              </h1>
              <p>{t(language, "Studio.exploreAnIdeaSeeWhat")}</p>
              <div className="hero-actions">
                <a className="button" href="#library">
                  {t(language, "Studio.browseTheLibrary")}
                </a>
                <a className="button secondary-button" href="#create">
                  {t(language, "Studio.createALesson")}
                </a>
              </div>
            </div>
            <FeaturedLesson language={language} id="explainback" />
          </section>
          <Gallery language={language} />
          <section className="create-invitation">
            <div>
              <p className="eyebrow">
                {t(language, "Studio.bringYourOwnQuestion")}
              </p>
              <h2>{t(language, "Studio.whatWouldYouLikeTo")}</h2>
              <p>{t(language, "Studio.letMuseDraftALesson")}</p>
            </div>
            <a className="button" href="#create">
              {t(language, "Studio.createALesson")}{" "}
              <span aria-hidden="true">↗</span>
            </a>
          </section>
        </>
      )}
      {view === "create" && !presenting && (
        <>
          <PageHeader
            language={language}
            crumbs={[
              { label: t(language, "App.library"), href: "#studio" },
              { label: t(language, "App.create") },
            ]}
            title={t(language, "Studio.startWithALittleCuriosity")}
            meta={`${t(language, "Studio.aQuestionOrASketch")} ${t(language, "Studio.sixStepsEachShowsItsCost")}`}
          />
          <JudgePath
            language={language}
            steps={judgeSteps}
            reviewed={reviewed}
            running={judgeRunning || busy}
            blocked={judgeBlocker(
              judgeSteps,
              providerStatus?.access?.remaining ?? null,
              remaining,
            )}
            used={8 - remaining}
            actions={authenticated && Boolean(target?.configured)}
            onRun={(id) => void runJudgeStep(id)}
            onRunAll={() => void runJudgeAll()}
          />
        </>
      )}
      {!draft && view === "create" && (
        <section className="author-workspace">
          {!authenticated ? (
            <div className="creation-locked">
              <p>{t(language, "Studio.lessonCreationIsAvailableTo")}</p>
              <button onClick={onRequestAccess}>
                {t(language, "Studio.enterWithAccessCode")}
              </button>
            </div>
          ) : (
            <>
              <form
                className="author-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void request("compose");
                }}
              >
                <label htmlFor={`${formId}-topic`}>
                  {t(language, "Studio.whatWouldYouLikeTo2")}
                </label>
                <textarea
                  id={`${formId}-topic`}
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  maxLength={600}
                  rows={4}
                  placeholder={t(language, "Studio.whyDoesCoffeeCoolMore")}
                  disabled={busy}
                />
                <div className="topic-starters">
                  <span>{t(language, "Studio.tryAStartingPoint")}</span>
                  {[
                    [
                      "Cooling coffee",
                      "咖啡冷却",
                      studioWalkthrough(language).topic,
                    ],
                    [
                      "Web requests",
                      "网页请求",
                      t(language, "Studio.explainHowABrowserLoads"),
                    ],
                    [
                      "Quantum interference",
                      "量子干涉",
                      t(language, "Studio.howDoesAQuantumComputer"),
                    ],
                  ].map(([en, zh, value]) => (
                    <button
                      type="button"
                      className="text-button"
                      key={en}
                      disabled={busy}
                      onClick={() => setTopic(value)}
                    >
                      {say(language, en, zh)} ↗
                    </button>
                  ))}
                </div>
                <div className="author-settings">
                  <label>
                    {t(language, "Studio.creationMode")}
                    <select
                      value={creation}
                      onChange={(event) => setCreation(event.target.value)}
                      disabled={busy}
                    >
                      <option value="generated">
                        {t(language, "Studio.newTopicDemo")}
                      </option>
                      <option value="catalog">
                        {t(language, "Studio.existingExperiments")}
                      </option>
                    </select>
                  </label>
                  <label>
                    {t(language, "Studio.creatorModel")}
                    <select
                      value={target?.id ?? ""}
                      onChange={(event) => {
                        setModelId(event.target.value);
                        invalidate();
                      }}
                      disabled={busy}
                    >
                      {targets.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          disabled={!m.configured}
                        >
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="image-attachment">
                  <label className="file-action">
                    <span aria-hidden="true">＋</span>
                    {t(language, "Studio.addAPhotoSketchOr")}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={(event) => {
                        if (!busyRef.current && authenticated)
                          void image.attach(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      disabled={busy}
                    />
                  </label>
                  <span className="fine">
                    {t(language, "Studio.optionalUpTo12Mb")}
                  </span>
                  {image.loading && (
                    <p role="status">
                      {t(language, "Studio.preparingImageLocally")}
                    </p>
                  )}
                  {image.image && (
                    <div className="image-preview">
                      <img
                        src={image.image.dataUrl}
                        alt={t(language, "Studio.attachedImagePreview")}
                      />
                      <span>{image.image.name}</span>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={image.clear}
                      >
                        {t(language, "Studio.removeImage")}
                      </button>
                    </div>
                  )}
                </div>
                <label className="search-first">
                  <input
                    type="checkbox"
                    checked={searchFirst}
                    disabled={busy || creation !== "generated"}
                    onChange={(event) => setSearchFirst(event.target.checked)}
                  />
                  <span>
                    {t(language, "Studio.searchFirst")}
                    <span className="fine">
                      {t(language, "Studio.searchFirstNote")}
                    </span>
                  </span>
                </label>
                <div className="author-submit">
                  <button
                    type="submit"
                    disabled={busy || image.loading || !canRequest}
                  >
                    {say(
                      language,
                      busy ? "Muse is working…" : "Create a lesson",
                      busy ? "Muse 正在处理…" : "创建课程",
                    )}{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                  {canCompare && (
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy || image.loading || !canRequest}
                      onClick={() => void compareModels()}
                    >
                      {busy
                        ? t(language, "Studio.comparing")
                        : t(language, "Studio.compareTwoModels")}{" "}
                      <span aria-hidden="true">⇄</span>
                    </button>
                  )}
                  {canCompare && (
                    <label className="compare-judge-pick">
                      {t(language, "Compare.judge")}
                      <select
                        value={judge?.id ?? ""}
                        onChange={(event) => setJudgeId(event.target.value)}
                        disabled={busy}
                      >
                        {judgeOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {evaluationModelLabel(m.model)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {canCompare && (
                    <label className="grounded-judge-pick">
                      <input
                        type="checkbox"
                        checked={groundedJudge}
                        disabled={busy}
                        onChange={(event) =>
                          setGroundedJudge(event.target.checked)
                        }
                      />
                      {t(language, "Compare.checkFiguresOnline")}
                    </label>
                  )}
                  <label className="file-action import-action">
                    {t(language, "Studio.importLessonJson")}
                    <input
                      type="file"
                      accept=".json,application/json"
                      disabled={busy}
                      onChange={(event) => {
                        void importLesson(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="fine author-privacy">
                  {t(language, "Studio.oneModelRequestWhenYou")}
                  {searchFirst &&
                    creation === "generated" &&
                    ` ${t(language, "Studio.searchFirstCost")}`}
                  {canCompare && ` ${t(language, "Studio.compareNote")}`}
                </p>
              </form>
              {comparison && !draft && (
                <LiveComparison
                  reply={comparison}
                  language={language}
                  busy={busy}
                  onUse={useComparedDraft}
                  onDiscard={() => {
                    setComparison(null);
                    setMessage("");
                  }}
                />
              )}
              <LessonShelf
                key={shelfRefresh}
                language={language}
                post={post}
                currentId={savedId}
                busy={busy}
                onOpen={openSaved}
                onNotice={setMessage}
                onDeleted={(id) => {
                  if (id === savedId) {
                    setSavedId(null);
                    setSavedItem(null);
                  }
                }}
              />
            </>
          )}
        </section>
      )}
      <div hidden={!showLesson}>
        {statusMessage && (
          <p className="studio-message" role="status">
            {statusMessage}
          </p>
        )}
        {busy && (
          <p className="request-progress" role="status">
            <span className="working-dot" />
            {backgroundRunning
              ? say(
                  language,
                  "Wonder is creating in the background. Keep this page open to receive the result.",
                  "Wonder 正在后台创建。请保持此页面打开以接收结果。",
                )
              : t(language, "Studio.museIsWorkingYourExisting")}
          </p>
        )}
        {showing && show && draft && (
          <Suspense fallback={loadingNote}>
            <ShowPlayer
              lesson={validateLesson(draft)}
              show={show.reply.show}
              cover={show.reply.cover}
              illustrations={show.reply.illustrations ?? null}
              language={language}
              scriptModel={show.reply.model ?? target?.model ?? null}
              coverModel={show.reply.coverModel}
              onClose={() => setShowing(false)}
              pace={pace}
              onPace={setPace}
              onIllustrate={
                authenticated &&
                providerStatus?.images &&
                target?.configured &&
                !external
                  ? (slide, direction) => void illustrate(slide, direction)
                  : undefined
              }
              illustrating={busy}
              canIllustrate={!busy && remaining > 0}
            />
          </Suspense>
        )}
        {draft && !showing && !presenting && (
          <Suspense fallback={loadingNote}>
            {revision ? (
              <RevisionSummary
                before={revision.before}
                after={draft}
                language={language}
                metrics={metrics?.mode === "revise" ? metrics : null}
                onDismiss={() => setRevision(null)}
                onRestore={() => {
                  const previous = revision.before;
                  loadLesson(previous);
                  setRevision(null);
                  setMessage(t(language, "Studio.restoredThePreviousDraftThe"));
                }}
              />
            ) : (
              metrics?.mode === "compose" && (
                <RequestSummary metrics={metrics} language={language} />
              )
            )}
            <DraftReview
              key={revisionKey}
              draft={draft}
              references={references}
              language={language}
              busy={busy}
              reviewed={reviewed}
              setReviewed={setReviewed}
              onChange={(next) => {
                setDraft(next);
                setReviewed(false);
              }}
              onPresent={present}
              onExport={exportLesson}
              onClose={() => {
                closeLesson();
                setMessage(t(language, "Studio.startedANewLesson"));
              }}
              onRevise={(text) => void request("compose", text)}
              canRequest={canRequest}
              tryout={tryout?.reply ?? null}
              onTryout={() => void tryLesson()}
              testerLabel={tester?.label ?? null}
              metrics={metrics}
              hasShow={Boolean(show)}
              onMakeShow={() => void makeShow()}
              onWatchShow={() => setShowing(true)}
              revision={revisionPrompt}
              setRevision={setRevisionPrompt}
              caches={caches}
              onRecreate={() => void request("compose")}
              onSave={authenticated ? () => void saveLesson() : undefined}
              savedId={savedId}
              saving={saving}
            />
          </Suspense>
        )}
        {presenting && player && (
          <>
            {source === "shared" && external && (
              <p className="shared-notice" role="note">
                {sharedProvenanceText(external, language)}{" "}
                <a
                  href={reportLessonUrl(external.id, external.title[language])}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t(language, "Library.reportThisLesson")}
                </a>
              </p>
            )}
            <LessonPlayer
              player={player}
              language={language}
              visible={visible && showLesson}
              busy={busy}
              canAsk={canRequest}
              feedback={feedback}
              onGuide={(own) => void request("guide", own)}
              onTranscribe={providerStatus?.voice ? transcribe : undefined}
              onClearFeedback={clearFeedback}
              onBack={() => setPresenting(false)}
              onLibrary={lessonId ? closeLesson : invalidate}
              guideCache={guide[String(player.state.chapter)] ?? null}
              explanations={explanations}
              onExplanations={setExplanations}
              pace={pace}
              onPace={setPace}
              onState={onPlayerState}
            />
            {lessonId &&
              authenticated &&
              providerStatus?.images &&
              target?.configured && (
                <CoverTool
                  key={lessonId}
                  language={language}
                  lessonId={lessonId}
                  busy={busy}
                  onDraw={drawCover}
                />
              )}
            {((feedback && metrics?.mode === "guide") ||
              metrics?.mode === "transcribe") && (
              <RequestSummary metrics={metrics} language={language} />
            )}
            {source && (
              <div className="lesson-provenance">
                {sourceImage && (
                  <Spotlight
                    language={language}
                    image={sourceImage}
                    detection={
                      detection?.image === sourceImage ? detection : null
                    }
                    onFind={
                      authenticated &&
                      providerStatus?.detect &&
                      target?.configured
                        ? (concept) => void detect(concept)
                        : undefined
                    }
                    busy={busy}
                    canFind={remaining > 0}
                  />
                )}
                {source === "evaluation" && evaluationItem && (
                  <p className="evaluation-question">
                    <strong>{t(language, "Gallery.theLearnerAsked")}</strong>{" "}
                    {evaluationItem.question[language]}
                  </p>
                )}
                <p>
                  {source === "shared" && external
                    ? sharedProvenanceText(external, language)
                    : source === "studio-sketch"
                      ? t(language, "Studio.sketchLessonNote")
                      : source === "evaluation" && evaluationItem
                        ? evaluationNote(evaluationItem, language)
                        : gallerySourceNote(source, language)}
                  {external?.model &&
                    source === "shared" &&
                    ` · ${external.model}`}
                </p>
                {source === "evaluation" && evaluationItem && (
                  <p className="evaluation-links fine">
                    <a href={EVALUATION_CARD_HASH}>
                      {t(language, "Gallery.evaluationCard")}
                    </a>
                    {evaluationComparison(evaluationItem.caseId) && (
                      <>
                        {" · "}
                        <a href={`#compare:${evaluationItem.caseId}`}>
                          {t(language, "Gallery.compareTheTwoModels")}
                        </a>
                      </>
                    )}
                  </p>
                )}
                {source === "shared" && show && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowing(true)}
                  >
                    {t(language, "Library.watchTheShow")} ▶
                  </button>
                )}
              </div>
            )}
          </>
        )}
        {remaining === 0 && authenticated && (
          <div className="notice">
            <p>{t(language, "Studio.thisProviderSessionHasUsed")}</p>
            <button className="secondary" onClick={() => invalidate()}>
              {t(language, "Studio.startANewProviderSession")}
            </button>
          </div>
        )}
        {authenticated && (
          <Suspense fallback={null}>
            <ProviderConsole
              post={post}
              language={language}
              enabled={
                Boolean(providerStatus?.traceEnabled) && visible && showLesson
              }
              sessionId={sessionId}
              busy={busy}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
