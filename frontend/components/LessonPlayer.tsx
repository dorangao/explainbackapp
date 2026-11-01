import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useId,
} from "react";
import { t } from "../lib/messages";
import {
  presentExperiment,
  rememberUnitSystem,
  rememberedUnitSystem,
  toDisplay,
  type UnitSystem,
} from "../lib/units";
import { MicrophoneError, startRecording } from "../lib/recorder";
import type { Recording } from "../lib/recorder";
import type { Feedback, Language, Player } from "../lib/types";
import { say } from "../lib/types";
import { formatDemoNumber } from "../lib/shared";
import { guideKey, paceFactor, paces } from "../lib/studio-cache";
import { PageHeader } from "./PageHeader";
import type { Cached, Pace } from "../lib/studio-cache";
import { CacheNote, actionLabel } from "./CacheNote";
import { measureQuantum, sampleQuantum } from "../../public/quantum.mjs";
import { ExperimentView } from "./ExperimentView";
const measure = measureQuantum as (state: unknown) => {
  state: unknown;
  outcome: number;
};
const sample = sampleQuantum as (state: unknown) => number[];
const verdictKeys = {
  supported: "LessonPlayer.supportedByTheEvidence",
  partly: "LessonPlayer.partlySupported",
  unsupported: "LessonPlayer.notYetSupported",
} as const;
export function LessonPlayer({
  player,
  language,
  visible,
  busy,
  canAsk,
  feedback,
  onGuide,
  onTranscribe,
  onClearFeedback,
  onBack,
  onLibrary,
  guideCache = null,
  explanations,
  onExplanations,
  pace = "off",
  onPace,
  onState,
}: {
  player: Player;
  language: Language;
  visible: boolean;
  busy: boolean;
  canAsk: boolean;
  feedback: Feedback | null;
  onGuide: (explanation?: string) => void;
  // Speech to text for the explain-back; absent when the server has no voice model.
  onTranscribe?: (wav: Blob) => Promise<string | null>;
  onClearFeedback: () => void;
  onBack: () => void;
  onLibrary: () => void;
  // The remembered Muse feedback for the current chapter, shown without a request while
  // the explanation and experiment are unchanged.
  guideCache?: Cached<Feedback> | null;
  // The learner's own explanations per chapter, remembered with the draft.
  explanations?: Record<string, string>;
  onExplanations?: (value: Record<string, string>) => void;
  // Guided replay: the lesson advances on its own at this pace; "off" is manual.
  pace?: Pace;
  onPace?: (pace: Pace) => void;
  // Reports the engine's state after each change so the draft memory can keep it.
  onState?: (state: Player["state"]) => void;
}) {
  const formId = useId();
  const [, update] = useReducer((n) => n + 1, 0),
    [playing, setPlaying] = useState(false),
    [answer, setAnswer] = useState(""),
    [result, setResult] = useState<boolean | "invalid" | null>(null),
    [notice, setNotice] = useState(""),
    [observation, setObservation] = useState<{
      state: unknown;
      outcome: number;
    } | null>(null),
    [counts, setCounts] = useState<number[] | null>(null),
    // The learner's own explanation, kept per chapter so a replay does not erase it.
    [own, setOwnState] = useState<Record<string, string>>(
      () => explanations ?? {},
    ),
    // Guided replay: paused by any manual action; the bar shows the current step's timer.
    [paused, setPaused] = useState(pace !== "off"),
    [bar, setBar] = useState(0),
    // Spoken explanation: microphone → WAV → Muse Voice Transcribe → the textarea.
    [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle"),
    [voiceNote, setVoiceNote] = useState(""),
    // Display units: the viewer's remembered choice, else the lesson's default, else as authored.
    [units, setUnits] = useState<UnitSystem>(
      () => rememberedUnitSystem() ?? player.lesson.units ?? "metric",
    );
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const recording = useRef<Recording | null>(null);
  const onExplanationsRef = useRef(onExplanations);
  onExplanationsRef.current = onExplanations;
  const setOwn = useCallback((next: Record<string, string>) => {
    setOwnState(next);
    onExplanationsRef.current?.(next);
  }, []);
  useEffect(
    () => () => {
      void recording.current?.stop().catch(() => {});
      recording.current = null;
    },
    [],
  );
  const stopVoice = useCallback(
    async (chapterIndex: number) => {
      const current = recording.current;
      if (!current || !onTranscribe) return;
      recording.current = null;
      setVoice("transcribing");
      try {
        const { wav, durationMs } = await current.stop();
        if (durationMs < 300) {
          setVoiceNote(t(language, "LessonPlayer.theRecordingWasTooShort"));
          return;
        }
        const text = await onTranscribe(wav);
        if (text) {
          const before = ownRef.current[chapterIndex]?.trimEnd();
          setOwn({
            ...ownRef.current,
            [chapterIndex]: (before ? `${before} ${text}` : text).slice(0, 700),
          });
          setVoiceNote(t(language, "LessonPlayer.transcribedByMuseVoiceEdit"));
        } else setVoiceNote("");
      } finally {
        setVoice("idle");
      }
    },
    [language, onTranscribe, setOwn],
  );
  const startVoice = useCallback(
    async (chapterIndex: number) => {
      setVoiceNote("");
      try {
        recording.current = await startRecording({
          onAutoStop: () => void stopVoice(chapterIndex),
        });
        setVoice("recording");
      } catch (error) {
        setVoiceNote(
          t(
            language,
            error instanceof MicrophoneError && error.message === "denied"
              ? "LessonPlayer.microphoneAccessWasNotGranted"
              : "LessonPlayer.thisBrowserCannotRecord",
          ),
        );
      }
    },
    [language, stopVoice],
  );
  const heading = useRef<HTMLHeadingElement>(null),
    state = player.state;
  // The player mutates in place; chapter, variant, metric and controls key the memo.
  const experimentKey = `${state.chapter}/${state.variant}/${state.metric}/${JSON.stringify(state.controls)}`;
  const base = useMemo(
    () => player.experiment(language),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- experimentKey summarises the mutable player state
    [player, language, experimentKey],
  );
  // What the viewer sees; the engine, the model and the checks keep the authored units.
  const presented = useMemo(
    () => presentExperiment(base, units),
    [base, units],
  );
  const e = presented.experiment;
  const chapter = player.lesson.chapters[state.chapter],
    ownText = own[state.chapter] ?? "";
  const ownRef = useRef(own);
  ownRef.current = own;
  // The remembered feedback is current only while its inputs still fingerprint the same.
  const currentGuideKey = guideKey(player, language, ownText);
  const cachedFeedback =
    guideCache && !feedback
      ? { at: guideCache.at, stale: guideCache.key !== currentGuideKey }
      : null;
  const shownFeedback =
    feedback ??
    (cachedFeedback && !cachedFeedback.stale ? guideCache!.reply : null);
  const stateKey = `${state.chapter}/${state.stage}/${state.prediction}/${state.progress}/${state.transfer}/${experimentKey}`;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  useEffect(() => {
    onStateRef.current?.(player.state);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateKey summarises the mutable player state
  }, [player, stateKey]);
  // Pause when the lesson is hidden, busy or re-localised; playback resumes only on request.
  const pauseKey = `${language}/${visible}/${busy}`;
  const lastPause = useRef(pauseKey);
  if (lastPause.current !== pauseKey) {
    lastPause.current = pauseKey;
    if (playing) setPlaying(false);
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  const factor = paceFactor(pace);
  useEffect(() => {
    if (!playing || busy || !visible || state.stage !== "experiment") return;
    let frame = 0,
      last = 0,
      progress = player.state.progress;
    const tick = (now: number) => {
      if (last)
        progress = Math.min(1, progress + (now - last) / (6000 * factor));
      last = now;
      player.scrub(progress);
      update();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, busy, visible, player, state.stage, factor]);
  // Any manual action takes over from the guided replay until Resume.
  const manual = () => {
    if (pace !== "off" && !paused) setPaused(true);
  };
  const resetFeedback = () => {
    onClearFeedback();
    setResult(null);
    setObservation(null);
    setCounts(null);
    setNotice("");
  };
  const act = (fn: () => void) => {
    manual();
    setPlaying(false);
    resetFeedback();
    fn();
    update();
  };
  // Guided replay: predict → experiment (auto-play) → explain → transfer, each after a
  // dwell scaled by the pace. It never sends a model request; the transfer answer is the
  // lesson's own, revealed so a presenter can keep going.
  const guided = pace !== "off" && !paused && !busy && visible;
  const stage = state.stage,
    progressDone = state.progress === 1;
  useEffect(() => {
    if (!guided) return;
    if (stage === "complete") {
      setPaused(true);
      return;
    }
    if (stage === "experiment" && !progressDone) {
      setPlaying(true);
      setBar(0);
      return;
    }
    const dwell =
      (stage === "predict"
        ? 4000
        : stage === "experiment"
          ? 2500
          : stage === "explain"
            ? 8000
            : 6000) * factor;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setBar(Math.min(1, (now - started) / dwell));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const timer = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      if (stage === "predict" && !player.state.prediction)
        player.predict("unsure");
      if (stage === "transfer" && player.state.transfer !== true) {
        const { answer: expected, unit } = player.experiment().transfer;
        setAnswer(String(toDisplay(expected, unit, unitsRef.current)));
        setResult(player.check(String(expected)));
      }
      onClearFeedback();
      player.next();
      setBar(0);
      update();
    }, dwell);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stage and progressDone summarise the mutable player state
  }, [guided, stage, progressDone, factor, player]);
  useEffect(() => {
    if (pace === "off") setBar(0);
  }, [pace]);
  const stages = {
    predict: t(language, "LessonPlayer.makeAPrediction"),
    experiment: t(language, "LessonPlayer.runTheExperiment"),
    explain: t(language, "LessonPlayer.explainWhatChanged"),
    transfer: t(language, "LessonPlayer.tryAFreshCase"),
    complete: t(language, "LessonPlayer.aClearerExplanation"),
  };
  const labels = [
    t(language, "LessonPlayer.predict"),
    t(language, "LessonPlayer.experiment"),
    t(language, "LessonPlayer.explain"),
    t(language, "LessonPlayer.transfer"),
  ];
  const index = [
    "predict",
    "experiment",
    "explain",
    "transfer",
    "complete",
  ].indexOf(state.stage);
  // What each bubble of the flow holds, shown on hover and in the disclosure.
  const flowTips = [
    t(language, "LessonPlayer.flowPredict"),
    t(language, "LessonPlayer.flowExperiment"),
    t(language, "LessonPlayer.flowExplain"),
    t(language, "LessonPlayer.flowTransfer"),
  ];
  const nextDisabled =
    busy ||
    (state.stage === "predict" && !state.prediction) ||
    (state.stage === "experiment" && state.progress !== 1) ||
    (state.stage === "transfer" && state.transfer !== true);
  const nextLabel =
    state.stage === "complete"
      ? t(language, "LessonPlayer.restartLesson")
      : state.stage === "predict"
        ? t(language, "LessonPlayer.testThisClaim")
        : state.stage === "experiment"
          ? t(language, "LessonPlayer.explainTheResult")
          : state.stage === "explain"
            ? t(language, "LessonPlayer.tryAFreshCase2")
            : state.chapter === player.lesson.chapters.length - 1
              ? t(language, "LessonPlayer.finishLesson")
              : t(language, "LessonPlayer.nextChapter");
  const nextRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!visible) return;
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
      if (event.key === " " && pace !== "off" && !typing) {
        event.preventDefault();
        setPaused((p) => !p);
      } else if (event.key === "ArrowRight" && !typing) nextRef.current();
      else if (event.key === "ArrowLeft" && !typing) {
        if (!["predict", "complete"].includes(player.state.stage))
          act(() => player.replay());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- act is recreated each render; the ref carries the latest next
  }, [visible, pace, player]);
  nextRef.current = () => {
    if (nextDisabled) return;
    act(() => {
      if (player.state.stage === "complete") player.restart();
      else player.next();
    });
    setAnswer("");
    heading.current?.focus();
  };
  // The step's primary action: in the Predict row beside the three calls, else at the end.
  const nextButton = (
    <button
      disabled={nextDisabled}
      onClick={() => {
        nextRef.current();
      }}
    >
      {nextLabel}
    </button>
  );
  function setInput(id: string, value: number) {
    try {
      act(() => player.input(id, value));
      return true;
    } catch {
      setNotice(t(language, "LessonPlayer.useAValueWithinThe"));
    }
    return false;
  }
  return (
    <section
      className="lesson-player"
      data-stage={state.stage}
      data-chapter={state.chapter}
      data-progress={state.progress}
      aria-labelledby={`${formId}-title`}
    >
      <PageHeader
        language={language}
        crumbs={[
          {
            label: t(language, "App.library"),
            href: "#studio",
            onClick: onLibrary,
          },
          { label: player.lesson.title[language] },
        ]}
        eyebrow={`${t(language, "LessonPlayer.chapter")} ${state.chapter + 1} / ${player.lesson.chapters.length} · ${e.title}`}
        title={player.lesson.title[language]}
        titleId={`${formId}-title`}
        actions={
          <>
            <button className="text-button" onClick={onBack} disabled={busy}>
              {t(language, "LessonPlayer.lessonOverview")}
            </button>
            <label className="replay-pace">
              {t(language, "Replay.guidedReplay")}
              <select
                value={pace}
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.value as Pace;
                  setPaused(false);
                  onPace?.(next);
                }}
              >
                {paces.map((value) => (
                  <option key={value} value={value}>
                    {t(language, `Replay.${value}` as const)}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
      />
      <p className="player-framing">{chapter.framing[language]}</p>
      {pace !== "off" && (
        <div className="replay-bar-row" data-pace={pace}>
          <>
            <button
              type="button"
              className="secondary"
              disabled={busy || state.stage === "complete"}
              aria-pressed={!paused}
              onClick={() => setPaused((p) => !p)}
            >
              {paused
                ? t(language, "Replay.resume")
                : t(language, "Replay.pause")}
            </button>
            <progress
              className="replay-progress"
              aria-label={t(language, "Replay.progress")}
              max={1}
              value={
                state.stage === "experiment" && !progressDone
                  ? state.progress
                  : bar
              }
            />
            <span className="fine" role="status">
              {state.stage === "complete"
                ? t(language, "Replay.finished")
                : paused
                  ? t(language, "Replay.paused")
                  : t(language, "Replay.running")}
            </span>
          </>
        </div>
      )}
      <nav
        className="learning-flow"
        aria-label={t(language, "LessonPlayer.learningProgress")}
      >
        <ol>
          {labels.map((label, i) => (
            <li
              key={label}
              aria-current={index === i ? "step" : undefined}
              className={
                index > i ? "is-complete" : index === i ? "is-current" : ""
              }
            >
              <span className="flow-node" aria-hidden="true">
                {index > i ? "✓" : i + 1}
              </span>
              <span className="flow-label">{label}</span>
              <span className="flow-tip" role="tooltip">
                {index > i ? `${t(language, "LessonPlayer.done")} · ` : ""}
                {flowTips[i]}
              </span>
            </li>
          ))}
        </ol>
        <details className="flow-details">
          <summary>{t(language, "LessonPlayer.whatHappensAtEachStep")}</summary>
          <div>
            {labels.map((label, i) => (
              <p key={label}>
                <strong>{label}.</strong> {flowTips[i]}
              </p>
            ))}
          </div>
        </details>
      </nav>
      <div className="player-layout">
        <div className="player-main">
          <div className="stage-card">
            <div className="stage-head">
              <h3 ref={heading} tabIndex={-1}>
                {stages[state.stage]}
              </h3>
              {index < labels.length && (
                <span className="fine">
                  {t(language, "LessonPlayer.stepOf")
                    .replace("{n}", String(index + 1))
                    .replace("{total}", String(labels.length))}
                </span>
              )}
            </div>
            {!["transfer", "complete"].includes(state.stage) && (
              <blockquote className="claim">
                <span className="eyebrow">
                  {t(language, "LessonPlayer.theClaim")}
                </span>
                {e.claim}
              </blockquote>
            )}
            {state.stage === "predict" && (
              <>
                <div className="prediction-row">
                  <span className="prediction-prompt">
                    {t(language, "LessonPlayer.yourCall")}
                  </span>
                  {(["agree", "disagree", "unsure"] as const).map(
                    (value, i) => (
                      <button
                        key={value}
                        className="secondary"
                        aria-pressed={state.prediction === value}
                        disabled={busy}
                        onClick={() => {
                          manual();
                          player.predict(value);
                          update();
                        }}
                      >
                        {
                          [
                            t(language, "LessonPlayer.agree"),
                            t(language, "LessonPlayer.disagree"),
                            t(language, "LessonPlayer.notSure"),
                          ][i]
                        }
                      </button>
                    ),
                  )}
                  {nextButton}
                </div>
                <p className="fine">
                  {t(language, "LessonPlayer.chooseBeforeRevealingTheResult")}
                </p>
              </>
            )}
          </div>
          {state.stage === "predict" && e.kind !== "process" && (
            <div className="experiment-surface experiment-preview">
              <div className="preview-head">
                <span className="eyebrow">
                  {t(language, "LessonPlayer.whatYouWillTest")}
                </span>
                <span className="fine">{e.caption(0)}</span>
              </div>
              <ExperimentView
                experiment={e}
                progress={0}
                language={language}
                interactive={false}
                preview
                onScrub={() => {}}
              />
            </div>
          )}
          {["experiment", "explain"].includes(state.stage) && (
            <div className="experiment-surface">
              <ExperimentView
                experiment={e}
                progress={state.progress}
                language={language}
                interactive={!busy && state.stage === "experiment"}
                onScrub={(v) => act(() => player.scrub(v))}
              />
              <p className="experiment-caption">{e.caption(state.progress)}</p>
              <label className="scrub-label">
                {t(language, "LessonPlayer.experimentProgress")}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step={1 / e.steps}
                  value={state.progress}
                  onChange={(event) =>
                    act(() => player.scrub(Number(event.target.value)))
                  }
                  disabled={busy || state.stage !== "experiment"}
                />
              </label>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy || state.stage !== "experiment"}
                  onClick={() => {
                    manual();
                    if (playing) setPlaying(false);
                    else {
                      if (state.progress === 1) player.scrub(0);
                      setObservation(null);
                      setCounts(null);
                      setPlaying(true);
                    }
                  }}
                >
                  {say(
                    language,
                    playing
                      ? "Pause"
                      : e.kind === "process"
                        ? "Play process"
                        : "Play experiment",
                    playing
                      ? "暂停"
                      : e.kind === "process"
                        ? "播放过程"
                        : "播放实验",
                  )}
                </button>
                <button
                  className="text-button"
                  disabled={busy || state.stage !== "experiment"}
                  onClick={() => act(() => player.scrub(1))}
                >
                  {t(language, "LessonPlayer.showFinalState")}
                </button>
              </div>
              {state.progress === 1 && e.metrics.length > 0 && (
                <dl className="experiment-metrics">
                  {e.metrics.map((m) => (
                    <div key={m.label}>
                      <dt>{m.label}</dt>
                      <dd>
                        {formatDemoNumber(m.value)} <small>{m.unit}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {e.quantumState !== undefined && (
                <div className="quantum-measure">
                  <p className="fine">
                    {t(
                      language,
                      "LessonPlayer.curvesShowPreMeasurementProbabilities",
                    )}
                  </p>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={busy || state.progress !== 1}
                      onClick={() => {
                        setObservation(
                          measure(observation?.state ?? e.quantumState),
                        );
                        setCounts(null);
                      }}
                    >
                      {say(
                        language,
                        observation
                          ? "Read this measured state again"
                          : "Measure once",
                        observation ? "再次读取本次测量后的状态" : "测量一次",
                      )}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || state.progress !== 1}
                      onClick={() => {
                        setCounts(sample(e.quantumState));
                        setObservation(null);
                      }}
                    >
                      {t(language, "LessonPlayer.256FreshPreparations")}
                    </button>
                  </div>
                  <p role="status">
                    {observation
                      ? `${t(language, "LessonPlayer.measuredState")} |${e.basisLabels?.[observation.outcome]}⟩`
                      : counts
                        ? counts
                            .map((n, i) => `|${e.basisLabels?.[i]}⟩ ${n}/256`)
                            .join(" · ")
                        : ""}
                  </p>
                </div>
              )}
            </div>
          )}
          {state.stage === "explain" && (
            <section className="evidence-summary">
              <p className="eyebrow">
                {t(language, "LessonPlayer.calculatedEvidence")}
              </p>
              <p>{e.result}</p>
              <div className="explain-back">
                <p className="eyebrow">
                  {t(language, "LessonPlayer.explainItBack")}
                </p>
                <label htmlFor={`${formId}-own`}>
                  {t(language, "LessonPlayer.explainWhatChangedAndWhy")}
                </label>
                <textarea
                  id={`${formId}-own`}
                  rows={3}
                  maxLength={700}
                  disabled={busy}
                  value={ownText}
                  onChange={(event) => {
                    manual();
                    setOwn({ ...own, [state.chapter]: event.target.value });
                  }}
                />
                {canAsk && onTranscribe && (
                  <div className="explain-back-voice">
                    {voice === "idle" && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => void startVoice(state.chapter)}
                      >
                        🎤 {t(language, "LessonPlayer.sayItInstead")}
                      </button>
                    )}
                    {voice === "recording" && (
                      <>
                        <button
                          type="button"
                          className="secondary recording"
                          onClick={() => void stopVoice(state.chapter)}
                        >
                          ■ {t(language, "LessonPlayer.stopAndTranscribe")}
                        </button>
                        <span className="fine" role="status">
                          {t(language, "LessonPlayer.recordingUpToOneMinute")}
                        </span>
                      </>
                    )}
                    {voice === "transcribing" && (
                      <button type="button" className="secondary" disabled>
                        {t(language, "LessonPlayer.transcribingWithMuseVoice")}
                      </button>
                    )}
                    {voiceNote && voice !== "recording" && (
                      <span className="fine" role="status">
                        {voiceNote}
                      </span>
                    )}
                  </div>
                )}
                <div className="explain-back-actions">
                  {canAsk ? (
                    <button
                      disabled={busy || !ownText.trim()}
                      onClick={() => onGuide(ownText.trim())}
                    >
                      {busy
                        ? t(language, "LessonPlayer.museIsWorking")
                        : actionLabel(
                            language,
                            t(
                              language,
                              "LessonPlayer.checkMyExplanationWithMuse",
                            ),
                            cachedFeedback,
                          )}
                    </button>
                  ) : (
                    <p className="fine">
                      {t(
                        language,
                        "LessonPlayer.museFeedbackOnYourExplanation",
                      )}
                    </p>
                  )}
                  <span className="fine">{ownText.length}/700</span>
                </div>
                <CacheNote cache={cachedFeedback} language={language} />
                {cachedFeedback?.stale && (
                  <p className="fine">
                    {t(language, "Cache.earlierFeedbackOutOfDate")}
                  </p>
                )}
              </div>
              <p className="eyebrow">
                {t(language, "LessonPlayer.authoredExplanationReviewable")}
              </p>
              <p>{chapter.explanation[language]}</p>
              {canAsk && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => onGuide()}
                >
                  {say(
                    language,
                    busy
                      ? "Muse is working…"
                      : "Ask Muse to explain this result",
                    busy ? "Muse 正在处理…" : "让 Muse 解释这个结果",
                  )}
                </button>
              )}
              {shownFeedback && (
                <div className="model-feedback">
                  {shownFeedback.verdict && (
                    <p>
                      <span
                        className="verdict"
                        data-verdict={shownFeedback.verdict}
                      >
                        {t(language, verdictKeys[shownFeedback.verdict])}
                      </span>
                    </p>
                  )}
                  <p>{shownFeedback.explanation}</p>
                  {shownFeedback.followUp && (
                    <p className="follow-up">
                      <strong>
                        {t(language, "LessonPlayer.followUpQuestion")}:
                      </strong>{" "}
                      {shownFeedback.followUp}
                    </p>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      act(() => {
                        if (shownFeedback.nextAction === "compare")
                          player.variant(1 - state.variant);
                        else if (shownFeedback.nextAction === "replay")
                          player.replay();
                        else player.next();
                      })
                    }
                  >
                    {say(
                      language,
                      {
                        compare: "Compare a preset",
                        replay: "Replay experiment",
                        transfer: "Try the transfer question",
                      }[shownFeedback.nextAction],
                      {
                        compare: "比较另一组设置",
                        replay: "重播实验",
                        transfer: "尝试迁移题",
                      }[shownFeedback.nextAction],
                    )}{" "}
                    →
                  </button>
                </div>
              )}
            </section>
          )}
          {state.stage === "transfer" && (
            <section className="transfer-question">
              <p className="pre-line">{e.transfer.question}</p>
              {e.transfer.type === "choice" ? (
                <div className="choice-list">
                  {e.transfer.choices?.map((choice, i) => (
                    <button
                      className="secondary"
                      disabled={busy}
                      key={i}
                      onClick={() => {
                        manual();
                        setResult(player.check(String(i)));
                        update();
                      }}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    manual();
                    // The learner answers in the displayed unit; the check runs in the authored one.
                    const typed = answer.trim() ? Number(answer) : NaN;
                    const inBase = Number.isFinite(typed)
                      ? String(presented.toBaseAnswer(typed))
                      : "";
                    setResult(player.check(inBase) ?? "invalid");
                    update();
                  }}
                >
                  <label>
                    {t(language, "LessonPlayer.yourAnswer")} ({e.transfer.unit})
                    <input
                      value={answer}
                      onChange={(event) => {
                        setAnswer(event.target.value);
                        setResult(null);
                        player.editAnswer();
                        update();
                      }}
                      inputMode="decimal"
                      maxLength={32}
                      disabled={busy}
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    {t(language, "LessonPlayer.checkAnswerLocally")}
                  </button>
                </form>
              )}
              <p
                className={
                  result === true ? "answer-correct" : "answer-feedback"
                }
                role="status"
              >
                {result === null
                  ? ""
                  : result === "invalid"
                    ? t(language, "LessonPlayer.enterAFiniteNumber")
                    : result
                      ? t(language, "LessonPlayer.thatMatchesThisModelReady")
                      : t(language, "LessonPlayer.thatDoesNotMatchYet")}
              </p>
            </section>
          )}
          {state.stage === "transfer" && (
            <details className="previous-experiment">
              <summary>
                {t(language, "LessonPlayer.previousExperiment")}
              </summary>
              <p className="fine">
                {t(language, "LessonPlayer.previousExperimentNote")}
              </p>
              <ExperimentView
                experiment={e}
                progress={1}
                language={language}
                interactive={false}
                onScrub={() => {}}
              />
              <p className="experiment-caption">{e.caption(1)}</p>
            </details>
          )}
          {state.stage === "complete" && (
            <div className="completion">
              <span className="completion-mark" aria-hidden="true">
                ✓
              </span>
              <p>
                {t(language, "LessonPlayer.youPredictedTestedExplainedAnd")}
              </p>
              <p className="fine">
                {t(language, "LessonPlayer.thisWalkthroughIsATeaching")}
              </p>
            </div>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {state.stage !== "predict" && (
            <div className="player-next">
              {nextButton}
              {!["predict", "complete"].includes(state.stage) && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => act(() => player.replay())}
                >
                  {t(language, "LessonPlayer.replayExperiment")}
                </button>
              )}
            </div>
          )}
        </div>
        {state.stage !== "complete" && (
          <aside className="player-inspector">
            <p className="eyebrow">
              {t(
                language,
                state.stage === "transfer"
                  ? "LessonPlayer.aboutThisModel"
                  : state.stage === "predict"
                    ? "LessonPlayer.setUpTheExperiment"
                    : "LessonPlayer.yourExperiment",
              )}
            </p>
            {state.prediction && state.stage !== "transfer" && (
              <p className="fine">
                {t(language, "LessonPlayer.yourPrediction")}
                {
                  {
                    agree: t(language, "LessonPlayer.agree"),
                    disagree: t(language, "LessonPlayer.disagree"),
                    unsure: t(language, "LessonPlayer.notSure"),
                  }[state.prediction]
                }
              </p>
            )}
            {!e.generated && state.stage !== "transfer" && (
              <label>
                {t(language, "LessonPlayer.compareAPresetResetsThis")}
                <select
                  value={state.variant}
                  onChange={(event) =>
                    act(() => player.variant(Number(event.target.value)))
                  }
                  disabled={busy}
                >
                  {e.variants.map((v, i) => (
                    <option key={i} value={i}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {presented.convertible && (
              <div
                className="unit-toggle"
                role="group"
                aria-label={t(language, "LessonPlayer.units")}
              >
                <span>{t(language, "LessonPlayer.units")}</span>
                {(["metric", "us"] as const).map((system) => (
                  <button
                    key={system}
                    type="button"
                    className="secondary"
                    aria-pressed={units === system}
                    disabled={busy}
                    onClick={() => {
                      setUnits(system);
                      rememberUnitSystem(system);
                    }}
                  >
                    {t(
                      language,
                      system === "metric"
                        ? "LessonPlayer.unitsMetric"
                        : "LessonPlayer.unitsUs",
                    )}
                  </button>
                ))}
                <small>{t(language, "LessonPlayer.unitsNote")}</small>
              </div>
            )}
            {state.stage !== "transfer" &&
              e.inputs?.map((input) => {
                // The slider works on the authored grid; the number field shows display units.
                const raw =
                  base.inputs?.find((p) => p.id === input.id) ?? input;
                const converted = raw.unit !== input.unit;
                return (
                  <div className="parameter" key={input.id}>
                    <div className="parameter-head">
                      <label htmlFor={`${formId}-parameter-${input.id}`}>
                        {input.label} <span>({input.unit})</span>
                      </label>
                      <input
                        id={`${formId}-parameter-${input.id}`}
                        type="number"
                        min={input.min}
                        max={input.max}
                        step={converted ? "any" : input.step}
                        key={`${input.id}-${input.value}`}
                        defaultValue={input.value}
                        disabled={busy}
                        onBlur={(event) => {
                          const value = event.target.value;
                          if (value !== "" && event.target.validity.valid) {
                            if (
                              Number(value) !== input.value &&
                              !setInput(
                                input.id,
                                presented.toBaseInput(input.id, Number(value)),
                              )
                            )
                              event.target.value = String(input.value);
                          } else {
                            event.target.value = String(input.value);
                            setNotice(
                              t(language, "LessonPlayer.useAValueWithinThe"),
                            );
                          }
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      aria-label={`${input.label} slider`}
                      min={raw.min}
                      max={raw.max}
                      step={raw.step}
                      value={raw.value}
                      disabled={busy}
                      onChange={(event) =>
                        setInput(input.id, Number(event.target.value))
                      }
                    />
                    <small>
                      {input.min} → {input.max} ·{" "}
                      {t(language, "LessonPlayer.changesResetYourPrediction")}
                    </small>
                  </div>
                );
              })}
            {state.stage !== "transfer" && (e.formulas?.length ?? 0) > 1 && (
              <label>
                {t(language, "LessonPlayer.graphOutput")}
                <select
                  value={state.metric}
                  disabled={busy}
                  onChange={(event) => {
                    player.output(Number(event.target.value));
                    update();
                  }}
                >
                  {e.formulas?.map((f, i) => (
                    <option key={f.id} value={i}>
                      {f.label} ({f.unit})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <details className="assumptions" open={state.stage !== "predict"}>
              <summary>{t(language, "LessonPlayer.assumptionsLimits")}</summary>
              <p>{e.assumptions}</p>
              {player.lesson.sources && player.lesson.sources.length > 0 && (
                <p className="fine lesson-sources">
                  {t(language, "LessonPlayer.sources")}{" "}
                  {player.lesson.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && " · "}
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title}
                      </a>
                    </span>
                  ))}
                </p>
              )}
              {e.generated && (
                <p className="fine">
                  {say(
                    language,
                    e.kind === "process"
                      ? "Authored steps and answers; not independently verified."
                      : "Calculations follow reviewed formulas. Scientific assumptions and units still need review.",
                    e.kind === "process"
                      ? "步骤与答案来自创作，未经独立验证。"
                      : "按已审阅公式计算，科学假设与单位仍需审阅。",
                  )}
                </p>
              )}
            </details>
          </aside>
        )}
      </div>
    </section>
  );
}
