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
import { MicrophoneError, startRecording } from "../lib/recorder";
import type { Recording } from "../lib/recorder";
import type { Feedback, Language, Player } from "../lib/types";
import { say } from "../lib/types";
import { formatDemoNumber } from "../lib/shared";
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
    [own, setOwn] = useState<Record<number, string>>({}),
    // Spoken explanation: microphone → WAV → Muse Voice Transcribe → the textarea.
    [voice, setVoice] = useState<"idle" | "recording" | "transcribing">("idle"),
    [voiceNote, setVoiceNote] = useState("");
  const recording = useRef<Recording | null>(null);
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
          setOwn((previous) => {
            const before = previous[chapterIndex]?.trimEnd();
            return {
              ...previous,
              [chapterIndex]: (before ? `${before} ${text}` : text).slice(
                0,
                700,
              ),
            };
          });
          setVoiceNote(t(language, "LessonPlayer.transcribedByMuseVoiceEdit"));
        } else setVoiceNote("");
      } finally {
        setVoice("idle");
      }
    },
    [language, onTranscribe],
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
  const e = useMemo(
    () => player.experiment(language),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- experimentKey summarises the mutable player state
    [player, language, experimentKey],
  );
  const chapter = player.lesson.chapters[state.chapter],
    ownText = own[state.chapter] ?? "";
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
  useEffect(() => {
    if (!playing || busy || !visible || state.stage !== "experiment") return;
    let frame = 0,
      last = 0,
      progress = player.state.progress;
    const tick = (now: number) => {
      if (last) progress = Math.min(1, progress + (now - last) / 6000);
      last = now;
      player.scrub(progress);
      update();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, busy, visible, player, state.stage]);
  const resetFeedback = () => {
    onClearFeedback();
    setResult(null);
    setObservation(null);
    setCounts(null);
    setNotice("");
  };
  const act = (fn: () => void) => {
    setPlaying(false);
    resetFeedback();
    fn();
    update();
  };
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
            : t(language, "LessonPlayer.nextChapter");
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
      <div className="player-toolbar">
        <a className="back-link" href="#studio" onClick={onLibrary}>
          <span aria-hidden="true">← </span>
          {t(language, "LessonPlayer.backToLibrary")}
        </a>
        <button className="text-button" onClick={onBack} disabled={busy}>
          {t(language, "LessonPlayer.lessonOverview")}
        </button>
      </div>
      <div className="player-heading">
        <p className="eyebrow">
          {t(language, "LessonPlayer.chapter")} {state.chapter + 1} /{" "}
          {player.lesson.chapters.length} · {e.title}
        </p>
        <h2 id={`${formId}-title`}>{player.lesson.title[language]}</h2>
        <p>{chapter.framing[language]}</p>
      </div>
      <ol
        className="learning-steps"
        aria-label={t(language, "LessonPlayer.learningProgress")}
      >
        {labels.map((label, i) => (
          <li
            key={label}
            aria-current={index === i ? "step" : undefined}
            className={index > i ? "is-complete" : ""}
          >
            <span>{index > i ? "✓" : `0${i + 1}`}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="player-layout">
        <div className="player-main">
          <h3 ref={heading} tabIndex={-1}>
            {stages[state.stage]}
          </h3>
          {state.stage !== "complete" && (
            <blockquote className="claim">
              <span className="eyebrow">
                {t(language, "LessonPlayer.theClaim")}
              </span>
              {e.claim}
            </blockquote>
          )}
          {state.stage === "predict" && (
            <>
              <p>
                {t(language, "LessonPlayer.chooseBeforeRevealingTheResult")}
              </p>
              <div className="prediction-options">
                {(["agree", "disagree", "unsure"] as const).map((value, i) => (
                  <button
                    key={value}
                    className="secondary"
                    aria-pressed={state.prediction === value}
                    disabled={busy}
                    onClick={() => {
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
                ))}
              </div>
            </>
          )}
          {!["predict", "complete"].includes(state.stage) && (
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
                  onChange={(event) =>
                    setOwn({ ...own, [state.chapter]: event.target.value })
                  }
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
                        : t(
                            language,
                            "LessonPlayer.checkMyExplanationWithMuse",
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
              {feedback && (
                <div className="model-feedback">
                  {feedback.verdict && (
                    <p>
                      <span className="verdict" data-verdict={feedback.verdict}>
                        {t(language, verdictKeys[feedback.verdict])}
                      </span>
                    </p>
                  )}
                  <p>{feedback.explanation}</p>
                  {feedback.followUp && (
                    <p className="follow-up">
                      <strong>
                        {t(language, "LessonPlayer.followUpQuestion")}:
                      </strong>{" "}
                      {feedback.followUp}
                    </p>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      act(() => {
                        if (feedback.nextAction === "compare")
                          player.variant(1 - state.variant);
                        else if (feedback.nextAction === "replay")
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
                      }[feedback.nextAction],
                      {
                        compare: "比较另一组设置",
                        replay: "重播实验",
                        transfer: "尝试迁移题",
                      }[feedback.nextAction],
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
                    setResult(player.check(answer) ?? "invalid");
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
          <div className="player-next">
            <button
              disabled={nextDisabled}
              onClick={() => {
                act(() => {
                  if (state.stage === "complete") player.restart();
                  else player.next();
                });
                setAnswer("");
                heading.current?.focus();
              }}
            >
              {nextLabel}
            </button>
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
        </div>
        <aside className="player-inspector">
          <p className="eyebrow">
            {t(language, "LessonPlayer.yourExperiment")}
          </p>
          {state.prediction && (
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
          {!e.generated && (
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
          {e.inputs?.map((input) => (
            <div className="parameter" key={input.id}>
              <label htmlFor={`${formId}-parameter-${input.id}`}>
                {input.label} <span>({input.unit})</span>
              </label>
              <input
                id={`${formId}-parameter-${input.id}`}
                type="number"
                min={input.min}
                max={input.max}
                step={input.step}
                key={`${input.id}-${input.value}`}
                defaultValue={input.value}
                disabled={busy}
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value !== "" && event.target.validity.valid) {
                    if (
                      Number(value) !== input.value &&
                      !setInput(input.id, Number(value))
                    )
                      event.target.value = String(input.value);
                  } else {
                    event.target.value = String(input.value);
                    setNotice(t(language, "LessonPlayer.useAValueWithinThe"));
                  }
                }}
              />
              <input
                type="range"
                aria-label={`${input.label} slider`}
                min={input.min}
                max={input.max}
                step={input.step}
                value={input.value}
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
          ))}
          {(e.formulas?.length ?? 0) > 1 && (
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
          <details className="assumptions" open>
            <summary>{t(language, "LessonPlayer.assumptionsLimits")}</summary>
            <p>{e.assumptions}</p>
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
      </div>
    </section>
  );
}
