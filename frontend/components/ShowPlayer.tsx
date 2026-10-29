import { t } from "../lib/messages";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Language, Lesson, Show } from "../lib/types";
import { say } from "../lib/types";
import { chapterExperiment, formatDemoNumber as fmt } from "../lib/shared";
import { ExperimentView } from "./ExperimentView";
import { paceFactor } from "../lib/studio-cache";
import type { Pace } from "../lib/studio-cache";

const speechAvailable = () =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";
// Reading time when no voice is available: about 55 ms per character, 4–14 s.
const readingMs = (text: string) =>
  Math.min(14000, Math.max(4000, text.length * 55));

// A narrated slide show. Slides are rendered from the checked lesson; the narration was
// written by the creator model; the voice is the browser's own speech synthesis.
export function ShowPlayer({
  lesson,
  show,
  cover,
  language,
  scriptModel,
  coverModel,
  onClose,
  pace: paceProp,
  onPace,
}: {
  lesson: Lesson;
  show: Show;
  cover: string | null;
  language: Language;
  scriptModel: string | null;
  coverModel: string | null;
  onClose: () => void;
  // Replay pace shared with the lesson player; "off" plays at the normal pace.
  pace?: Pace;
  onPace?: (pace: Pace) => void;
}) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [voice, setVoice] = useState(() => speechAvailable()),
    [progress, setProgress] = useState(0),
    [ownPace, setOwnPace] = useState<Pace>("normal"),
    // How far the current slide's narration time has run while playing.
    [bar, setBar] = useState(0);
  const pace = paceProp && paceProp !== "off" ? paceProp : ownPace;
  const factor = paceFactor(pace);
  const setPace = (next: Pace) => {
    setOwnPace(next);
    onPace?.(next);
  };
  const slide = show.slides[index],
    last = index === show.slides.length - 1;
  const chapter = lesson.chapters[slide.chapter] ?? lesson.chapters[0];
  const experiment = useMemo(
    () => chapterExperiment(chapter, 0, language),
    [chapter, language],
  );
  const narration = slide.narration[language];
  const stop = useCallback(() => {
    if (speechAvailable()) window.speechSynthesis.cancel();
  }, []);
  // A manual step takes over: playback pauses until Play is pressed again.
  const go = useCallback(
    (next: number) => {
      stop();
      setPlaying(false);
      setIndex(Math.max(0, Math.min(show.slides.length - 1, next)));
    },
    [show.slides.length, stop],
  );
  // Narration: speak the slide, or wait a reading time, then advance while playing.
  useEffect(() => {
    if (!playing) return;
    let timer = 0,
      cancelled = false;
    const advance = () => {
      if (cancelled) return;
      if (last) setPlaying(false);
      else setIndex((i) => Math.min(show.slides.length - 1, i + 1));
    };
    if (voice && speechAvailable()) {
      const utterance = new SpeechSynthesisUtterance(narration);
      utterance.lang = language === "zh" ? "zh-CN" : "en-US";
      const match = window.speechSynthesis
        .getVoices()
        .find((v) =>
          v.lang.toLowerCase().startsWith(language === "zh" ? "zh" : "en"),
        );
      if (match) utterance.voice = match;
      utterance.rate = Math.min(2, Math.max(0.5, 0.95 / factor));
      utterance.onend = advance;
      utterance.onerror = () => {
        timer = window.setTimeout(advance, readingMs(narration) * factor);
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else timer = window.setTimeout(advance, readingMs(narration) * factor);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (speechAvailable()) window.speechSynthesis.cancel();
    };
  }, [
    playing,
    index,
    voice,
    narration,
    language,
    last,
    show.slides.length,
    factor,
  ]);
  // The progress bar follows the estimated narration time of the current slide.
  useEffect(() => {
    if (!playing) {
      setBar(0);
      return;
    }
    const duration = readingMs(narration) * factor,
      started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setBar(Math.min(1, (now - started) / duration));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, index, narration, factor]);
  // Experiment slides sweep the parameter once, over roughly the narration time.
  useEffect(() => {
    if (slide.kind !== "experiment") return;
    const duration = Math.max(5000, readingMs(narration) * factor);
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const u = Math.min(1, (now - started) / duration);
      setProgress(u);
      if (u < 1) frame = requestAnimationFrame(tick);
    };
    setProgress(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [slide.kind, index, narration, factor]);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(index + 1);
      else if (event.key === "ArrowLeft") go(index - 1);
      else if (event.key === "Escape") onClose();
      else if (event.key === " " && event.target === document.body) {
        event.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [go, index, onClose]);
  const e = experiment;
  return (
    <section
      className="show-player"
      data-kind={slide.kind}
      aria-label={t(language, "ShowPlayer.lessonShow")}
    >
      <div className="show-stage">
        {slide.kind === "cover" && (
          <div className="show-cover">
            {cover && (
              <img
                src={cover}
                alt=""
                width={768}
                height={512}
                loading="eager"
              />
            )}
            <div>
              <p className="eyebrow">{t(language, "ShowPlayer.lessonShow2")}</p>
              <h1>{lesson.title[language]}</h1>
              <p className="lead-small">{lesson.intro[language]}</p>
            </div>
          </div>
        )}
        {slide.kind === "claim" && (
          <blockquote className="show-claim">
            <p className="eyebrow">{t(language, "ShowPlayer.theClaim")}</p>
            <p>{e.claim}</p>
          </blockquote>
        )}
        {slide.kind === "experiment" && (
          <div className="show-experiment">
            <ExperimentView
              experiment={e}
              progress={progress}
              language={language}
              interactive={false}
              onScrub={() => {}}
            />
            <p className="experiment-caption">{e.caption(progress)}</p>
          </div>
        )}
        {slide.kind === "evidence" && (
          <div className="show-evidence">
            <p className="eyebrow">
              {t(language, "ShowPlayer.calculatedEvidence")}
            </p>
            <p>{e.result}</p>
            {e.metrics.length > 0 && (
              <dl>
                {e.metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>
                      {fmt(m.value)} {m.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
        {slide.kind === "transfer" && (
          <div className="show-transfer">
            <p className="eyebrow">{t(language, "ShowPlayer.aFreshCase")}</p>
            <p className="pre-line">{e.transfer.question}</p>
            {e.transfer.choices?.map((choice, i) => (
              <p key={i} className="show-choice">
                {i + 1}. {choice}
              </p>
            ))}
          </div>
        )}
        {slide.kind === "takeaway" && (
          <div className="show-takeaway">
            <p className="eyebrow">{t(language, "ShowPlayer.takeaway")}</p>
            <p>{chapter.explanation[language]}</p>
          </div>
        )}
      </div>
      <div className="show-caption">
        <p className="eyebrow">{slide.heading[language]}</p>
        <p className="show-narration" aria-live="polite">
          {narration}
        </p>
      </div>
      <div className="show-controls">
        <button
          type="button"
          className="secondary"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label={t(language, "ShowPlayer.previousSlide")}
        >
          ←
        </button>
        <button type="button" onClick={() => setPlaying((p) => !p)}>
          {playing
            ? t(language, "ShowPlayer.pause")
            : last
              ? t(language, "ShowPlayer.playAgain")
              : t(language, "ShowPlayer.play")}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => go(index + 1)}
          disabled={last}
          aria-label={t(language, "ShowPlayer.nextSlide")}
        >
          →
        </button>
        <span className="show-counter">
          {index + 1} / {show.slides.length}
        </span>
        <label className="show-pace">
          {t(language, "Replay.pace")}
          <select
            value={pace}
            onChange={(event) => setPace(event.target.value as Pace)}
          >
            {(["slow", "normal", "fast"] as const).map((value) => (
              <option key={value} value={value}>
                {t(language, `Replay.${value}` as const)}
              </option>
            ))}
          </select>
        </label>
        <progress
          className="replay-progress"
          aria-label={t(language, "Replay.progress")}
          max={1}
          value={(index + bar) / show.slides.length}
        />
        <label className="show-voice">
          <input
            type="checkbox"
            checked={voice}
            disabled={!speechAvailable()}
            onChange={(event) => setVoice(event.target.checked)}
          />
          {t(language, "ShowPlayer.browserVoice")}
        </label>
        <button type="button" className="text-button" onClick={onClose}>
          {t(language, "ShowPlayer.closeShow")}
        </button>
      </div>
      <p className="fine show-credits">
        {scriptModel
          ? say(
              language,
              `Narration written by Meta ${scriptModel}`,
              `旁白由 Meta ${scriptModel} 撰写`,
            )
          : t(language, "ShowPlayer.narrationByTheAuthor")}
        {coverModel
          ? say(
              language,
              ` · cover drawn by Meta ${coverModel}`,
              ` · 封面由 Meta ${coverModel} 绘制`,
            )
          : ""}
        {t(language, "ShowPlayer.voiceByYourBrowserNot")}
      </p>
    </section>
  );
}
