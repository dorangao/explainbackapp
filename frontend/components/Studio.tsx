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
  Feedback,
  Language,
  Lesson,
  Player,
  Post,
  Status,
  TryoutReply,
  ShowReply,
} from "../lib/types";
import { say } from "../lib/types";
import { ApiError } from "../lib/api";
import {
  createLessonPlayer,
  galleryLessons,
  gallerySourceNote,
  studioWalkthrough,
  validateLesson,
} from "../lib/shared";
import { blobToBase64 } from "../lib/recorder";
import { useProviderSession } from "../hooks/useProviderSession";
import { useImageAttachment } from "../hooks/useImageAttachment";
import { Gallery } from "./Gallery";
import { LessonPlayer } from "./LessonPlayer";
import { RequestSummary } from "./RequestSummary";
const ShowPlayer = lazy(() =>
  import("./ShowPlayer").then((module) => ({ default: module.ShowPlayer })),
);
// Authoring, review and diagnostics load only when someone creates or revises.
const DraftReview = lazy(() =>
  import("./DraftReview").then((m) => ({ default: m.DraftReview })),
);
const RevisionSummary = lazy(() =>
  import("./RevisionSummary").then((m) => ({ default: m.RevisionSummary })),
);
const ProviderConsole = lazy(() =>
  import("./ProviderConsole").then((m) => ({ default: m.ProviderConsole })),
);

type Revision = { before: Lesson; after: Lesson };

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
  onRequestAccess,
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
  onRequestAccess: () => void;
}) {
  const formId = useId();
  const [topic, setTopic] = useState(""),
    [creation, setCreation] = useState("generated"),
    [modelId, setModelId] = useState(""),
    [draft, setDraft] = useState<Lesson | null>(null),
    [revisionKey, setRevisionKey] = useState(0),
    [reviewed, setReviewed] = useState(false),
    [player, setPlayer] = useState<Player | null>(null),
    [presenting, setPresenting] = useState(false),
    [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState<Feedback | null>(null),
    [revision, setRevision] = useState<Revision | null>(null),
    [tryout, setTryout] = useState<TryoutReply | null>(null),
    [show, setShow] = useState<ShowReply | null>(null),
    [showing, setShowing] = useState(false),
    [source, setSource] = useState<string | null>(null),
    [sourceImage, setSourceImage] = useState<string | null>(null);
  const clearFeedback = useCallback(() => setFeedback(null), []);
  const provider = useProviderSession({
    post,
    language,
    onBusy,
    onInvalidate: clearFeedback,
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
    setTryout(null);
    setShow(null);
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
    setTryout(null);
    setShow(null);
    setShowing(false);
    setMessage("");
  }, [invalidate]);
  // A gallery lesson is reviewed content: open it straight into the player.
  const openedGallery = useRef<string | null>(null);
  useEffect(() => {
    if (!lessonId || openedGallery.current === lessonId) return;
    const item = galleryLessons.find((g) => g.id === lessonId);
    if (!item) return;
    openedGallery.current = lessonId;
    invalidate();
    const lesson = loadLesson(structuredClone(item.lesson));
    setReviewed(true);
    setPlayer(createLessonPlayer(lesson));
    setPresenting(true);
    setSource(item.source);
    setSourceImage(item.image ?? null);
  }, [lessonId, invalidate, loadLesson]);
  // An invite or the Create link seeds the editable starter topic.
  const seenStarter = useRef(0);
  useEffect(() => {
    if (!starter || !authenticated || seenStarter.current === starter) return;
    seenStarter.current = starter;
    closeLesson();
    setTopic(studioWalkthrough(language).topic);
    setCreation("generated");
  }, [starter, authenticated, closeLesson, language]);
  // The generic failure line, plus the server's rejection reason when it sent one.
  const failureMessage = (error: unknown) =>
    t(language, "Studio.theRequestCouldNotBe") +
    (error instanceof ApiError && error.reason
      ? `\n${t(language, "Studio.reason")}: ${error.reason}`
      : "");
  // `text` is the revision request for compose, or the learner's own explanation for guide.
  async function request(mode: "compose" | "guide", text?: string) {
    const revisionText = mode === "compose" ? text : undefined,
      learnerText = mode === "guide" ? text?.trim() : undefined;
    if (
      busyRef.current ||
      !authenticated ||
      !target?.configured ||
      remaining === 0 ||
      image.loading
    )
      return;
    const attached = image.image;
    if (mode === "compose" && !revisionText && !topic.trim() && !attached) {
      setMessage(t(language, "Studio.enterAQuestionOrAttach"));
      return;
    }
    if (attached && !revisionText && target.provider !== "meta") {
      setMessage(t(language, "Studio.chooseAMetaModelFor"));
      return;
    }
    let body: Record<string, unknown>;
    try {
      body =
        mode === "compose"
          ? {
              topic:
                topic.trim() ||
                (!revisionText && attached
                  ? ""
                  : (draft?.title[language] ?? "")),
              creation,
              ...(!revisionText && attached ? { image: attached.dataUrl } : {}),
              ...(revisionText
                ? { draft: validateLesson(draft), revision: revisionText }
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
      return;
    }
    const before = revisionText && draft ? structuredClone(draft) : null;
    setMessage("");
    setFeedback(null);
    const result = await run<ComposeReply | Feedback>(
      target,
      mode === "guide" ? "guide" : revisionText ? "revise" : "compose",
      (id, options) =>
        post<ComposeReply | Feedback>(
          `/api/studio/${mode}`,
          { sessionId: id, ...body },
          options,
        ),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return;
    }
    if (mode === "compose") {
      const composed = result.reply as ComposeReply;
      if (composed.status === "ready" && composed.lesson) {
        const next = loadLesson(composed.lesson);
        setRevision(before ? { before, after: next } : null);
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
            (composed.message?.[language]
              ? `\n${composed.message[language]}`
              : ""),
        );
        if (!revisionText) image.clear();
      } else setMessage(composed.message[language]);
    } else setFeedback(result.reply as Feedback);
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
      return;
    let lesson: Lesson;
    try {
      lesson = validateLesson(draft);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return;
    }
    setMessage("");
    setTryout(null);
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
      return;
    }
    setTryout(result.reply);
    setMessage(t(language, "Studio.theTestLearnerTriedThis"));
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
      return;
    let lesson: Lesson;
    try {
      lesson = validateLesson(draft);
    } catch {
      setMessage(t(language, "Studio.completeBothLanguagesAndValidate"));
      return;
    }
    setMessage("");
    const result = await run<ShowReply>(target, "show", (id, options) =>
      post<ShowReply>("/api/studio/show", { sessionId: id, lesson }, options),
    );
    if (!result.ok) {
      if (!result.stale) setMessage(failureMessage(result.error));
      return;
    }
    setShow(result.reply);
    setShowing(true);
    setMessage(t(language, "Studio.theShowIsReady"));
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
            </div>
            <div className="intro-note">
              <span aria-hidden="true">↳</span>
              <p>{t(language, "Studio.understandingGrowsWhenYouCan")}</p>
            </div>
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
      {!draft && view === "create" && (
        <section className="author-workspace">
          <div className="workspace-heading">
            <div>
              <p className="eyebrow">{t(language, "Studio.01AskAQuestion")}</p>
              <h1>{t(language, "Studio.startWithALittleCuriosity")}</h1>
              <p>{t(language, "Studio.aQuestionOrASketch")}</p>
            </div>
            <a href="#studio" className="back-link">
              {t(language, "Studio.exploreTheLibrary")} ↗
            </a>
          </div>
          {!authenticated ? (
            <div className="creation-locked">
              <p>{t(language, "Studio.lessonCreationIsAvailableTo")}</p>
              <button onClick={onRequestAccess}>
                {t(language, "Studio.enterWithAccessCode")}
              </button>
            </div>
          ) : (
            <>
              <ol className="studio-steps">
                <li>
                  <span>01</span>
                  <strong>{t(language, "Studio.create")}</strong>
                  <small>{t(language, "Studio.bringAQuestionOrImage")}</small>
                </li>
                <li>
                  <span>02</span>
                  <strong>{t(language, "Studio.reviewRefine")}</strong>
                  <small>
                    {t(language, "Studio.checkTheModelAndAssumptions")}
                  </small>
                </li>
                <li>
                  <span>03</span>
                  <strong>{t(language, "Studio.experiment")}</strong>
                  <small>
                    {t(language, "Studio.predictOperateAndExplain")}
                  </small>
                </li>
              </ol>
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
                </p>
              </form>
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
            {t(language, "Studio.museIsWorkingYourExisting")}
          </p>
        )}
        {showing && show && draft && (
          <Suspense fallback={loadingNote}>
            <ShowPlayer
              lesson={validateLesson(draft)}
              show={show.show}
              cover={show.cover}
              language={language}
              scriptModel={show.model ?? target?.model ?? null}
              coverModel={show.coverModel}
              onClose={() => setShowing(false)}
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
              onClose={closeLesson}
              onRevise={(text) => void request("compose", text)}
              canRequest={canRequest}
              tryout={tryout}
              onTryout={() => void tryLesson()}
              testerLabel={tester?.label ?? null}
              metrics={metrics}
              hasShow={Boolean(show)}
              onMakeShow={() => void makeShow()}
              onWatchShow={() => setShowing(true)}
            />
          </Suspense>
        )}
        {presenting && player && (
          <>
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
              onLibrary={closeLesson}
            />
            {((feedback && metrics?.mode === "guide") ||
              metrics?.mode === "transcribe") && (
              <RequestSummary metrics={metrics} language={language} />
            )}
            {source && (
              <div className="lesson-provenance">
                {sourceImage && (
                  <img
                    src={sourceImage}
                    alt={t(language, "Studio.theSketchThisLessonWas")}
                    width={160}
                    height={120}
                    loading="lazy"
                  />
                )}
                <p>{gallerySourceNote(source, language)}</p>
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
