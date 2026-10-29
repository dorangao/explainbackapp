import { useEffect, useRef } from "react";
import {
  quantumCircuit,
  quantumProbabilities,
  measureQuantum,
  sampleQuantum,
  quantumLessons,
} from "../../../public/quantum.mjs";
import {
  quantumCopy,
  quantumLesson,
  quantumFrameText,
} from "../../../public/quantum-content.mjs";
import { ProviderConsole } from "../ProviderConsole";
import { useLabStore, useAfterRender } from "./useLabStore";
import type { LabProps, Language, RequestError, Target } from "./types";
import "../../labs.css";

type Amplitude = [number, number];
type Config = {
  lesson: string;
  phase: number;
  basis: string;
  target: number;
};
type Circuit = ReturnType<typeof quantumCircuit>;
type Frame = Circuit["frames"][number];
type Prediction = "agree" | "disagree" | "unsure";
type Feedback = {
  explanation: string;
  nextQuestion?: string;
  focus?: string;
  attemptsRemaining?: number;
};
type Store = {
  config: Config;
  step: number;
  prediction: Prediction | null;
  tested: boolean;
  guided: boolean;
  collapsed: { outcome: number; state: Amplitude[] } | null;
  counts: number[] | null;
  coachSession: { sessionId: string } | null;
  modelId: string;
  epoch: number;
  busy: boolean;
  feedback: Feedback | null;
  error: string;
  exhausted: boolean;
  after: Array<() => void>;
};
const PREDICTIONS: Prediction[] = ["agree", "disagree", "unsure"];
const DEFAULT_CONFIG = (): Config => ({
  lesson: "qubit",
  phase: Math.PI,
  basis: "Z",
  target: 3,
});
const fmt = (n: number) =>
  Math.abs(n) < 1e-10 ? "0" : String(Number(n.toFixed(3)));
const pct = (n: number) => `${Number((n * 100).toFixed(1))}%`;
const complex = ([r, i]: Amplitude) =>
  Math.abs(i) < 1e-10
    ? fmt(r)
    : `${fmt(r)} ${i < 0 ? "−" : "+"} ${fmt(Math.abs(i))}i`;
const SOURCES: [string, string][] = [
  [
    "IBM · quantum information",
    "https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/single-systems/quantum-information",
  ],
  [
    "IBM · entanglement",
    "https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/introduction",
  ],
  [
    "Microsoft · Grover search",
    "https://learn.microsoft.com/en-us/azure/quantum/concepts-grovers",
  ],
];

function CircuitDrawing({
  model,
  step,
  language,
}: {
  model: Circuit;
  step: number;
  language: Language;
}) {
  const zh = language === "zh";
  const height = model.n === 1 ? 88 : 134,
    width = 640,
    y = (i: number) => 42 + i * 48,
    gateX = (i: number) => 160 + (i - 1) * 165;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${zh ? "从左到右执行电路；当前" : "Circuit runs left to right; current"} ${model.frames[step].gate}`}
    >
      {Array.from({ length: model.n }, (_, i) => (
        <g key={`wire-${i}`}>
          <text x={12} y={y(i) + 5} fill="#47526d" fontSize={15}>
            {`q${i} |0⟩`}
          </text>
          <line
            x1={80}
            x2={620}
            y1={y(i)}
            y2={y(i)}
            stroke="#c0c8db"
            strokeWidth={2}
          />
        </g>
      ))}
      {model.frames.slice(1).map((f: Frame, index: number) => {
        const i = index + 1,
          x = gateX(i),
          active = i <= step,
          stroke = active ? "#5151a0" : "#aeb7c9",
          fill = i === step ? "#e2e1f4" : "#f8f8fa";
        return (
          <g key={`gate-${i}`}>
            {f.gate === "CNOT" ? (
              <>
                <line
                  x1={x}
                  x2={x}
                  y1={y(0)}
                  y2={y(1)}
                  stroke={stroke}
                  strokeWidth={2}
                />
                <circle cx={x} cy={y(0)} r={5} fill={stroke} />
                <circle
                  cx={x}
                  cy={y(1)}
                  r={13}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={2}
                />
                <path
                  d={`M ${x - 9} ${y(1)} H ${x + 9} M ${x} ${y(1) - 9} V ${y(1) + 9}`}
                  stroke={stroke}
                  strokeWidth={2}
                />
              </>
            ) : ["oracle", "diffuser"].includes(f.gate) ? (
              <>
                <rect
                  x={x - 43}
                  y={20}
                  width={86}
                  height={94}
                  rx={6}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={i === step ? 2.5 : 1}
                />
                <text
                  x={x}
                  y={72}
                  textAnchor="middle"
                  fill={stroke}
                  fontSize={14}
                >
                  {f.gate === "oracle"
                    ? zh
                      ? "标记"
                      : "Oracle"
                    : zh
                      ? "放大"
                      : "Diffuser"}
                </text>
              </>
            ) : (
              (f.targets as number[]).map((wire) => (
                <g key={`target-${wire}`}>
                  <rect
                    x={x - 23}
                    y={y(wire) - 20}
                    width={46}
                    height={40}
                    rx={6}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={i === step ? 2.5 : 1}
                  />
                  <text
                    x={x}
                    y={y(wire) + 6}
                    textAnchor="middle"
                    fill={stroke}
                    fontSize={18}
                  >
                    {f.gate === "H⊗H" ? "H" : f.gate === "P" ? "Pφ" : f.gate}
                  </text>
                </g>
              ))
            )}
            <text
              x={x}
              y={height - 5}
              textAnchor="middle"
              fill={stroke}
              fontSize={11}
            >
              {`${i}${i === step ? " ◀" : ""}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Bars({
  probabilities,
  labels,
  observations,
  theory,
}: {
  probabilities: number[];
  labels: string[];
  observations?: number[] | null;
  theory: string;
}) {
  return (
    <div className="q-bars">
      {labels.map((label, i) => (
        <div className="q-bar-row" key={label}>
          <span>{`|${label}⟩`}</span>
          <meter
            min={0}
            max={1}
            value={observations ? observations[i] / 256 : probabilities[i]}
            aria-label={`|${label}⟩ ${observations ? observations[i] + "/256" : pct(probabilities[i])}`}
          />
          <span>
            {observations
              ? `${observations[i]}/256 · ${theory} ${pct(probabilities[i])}`
              : pct(probabilities[i])}
          </span>
        </div>
      ))}
    </div>
  );
}

export function QuantumLab({
  language,
  visible,
  status,
  post,
  onBusy,
}: LabProps) {
  const [s, render] = useLabStore<Store>(() => ({
    config: DEFAULT_CONFIG(),
    step: 0,
    prediction: null,
    tested: false,
    guided: false,
    collapsed: null,
    counts: null,
    coachSession: null,
    modelId: "",
    epoch: 0,
    busy: false,
    feedback: null,
    error: "",
    exhausted: false,
    after: [],
  }));
  useAfterRender(s.after);
  const live = useRef({ language, visible, status, post, onBusy });
  live.current = { language, visible, status, post, onBusy };
  const heading = useRef<HTMLHeadingElement>(null);
  const api = useRef<ReturnType<typeof createController> | null>(null);
  if (api.current === null) api.current = createController();
  const c = api.current;

  function createController() {
    const circuit = () => quantumCircuit(s.config) as Circuit;
    const target = (): Target | undefined =>
      live.current.status.models.find((t) => t.id === s.modelId);
    const copy = () => quantumCopy[live.current.language];
    const setBusy = (value: boolean) => {
      s.busy = value;
      live.current.onBusy(value);
    };
    function invalidateCoach(remote = true) {
      s.epoch++;
      if (s.coachSession && remote)
        live.current
          .post("/api/reset", { sessionId: s.coachSession.sessionId })
          .catch(() => {});
      s.coachSession = null;
      s.feedback = null;
      s.error = "";
      s.exhausted = false;
      setBusy(false);
    }
    function resetExperiment({
      lesson = s.config.lesson,
      script = false,
    }: { lesson?: string; script?: boolean } = {}) {
      s.config.lesson = lesson;
      s.step = 0;
      s.prediction = script ? "agree" : null;
      s.tested = script;
      s.guided = script;
      s.collapsed = null;
      s.counts = null;
      s.feedback = null;
      s.error = "";
      render();
    }
    function go(next: number) {
      s.step = next;
      s.collapsed = null;
      s.counts = null;
      s.feedback = null;
      s.error = "";
      const model = circuit();
      if (s.guided && s.step === model.frames.length - 1)
        s.counts = sampleQuantum(model.frames[s.step].state) as number[];
      render();
    }
    const focusHeading = () => s.after.push(() => heading.current?.focus());
    async function ask(question: "why" | "claim") {
      const picked = target();
      if (
        s.busy ||
        !s.tested ||
        s.step !== circuit().frames.length - 1 ||
        !picked?.configured ||
        s.exhausted
      )
        return;
      const token = ++s.epoch,
        snapshot = { ...s.config },
        prediction = s.prediction,
        pickedLanguage = live.current.language;
      setBusy(true);
      s.feedback = null;
      s.error = "";
      render();
      const send = <T,>(path: string, body: unknown) =>
        live.current.post<T>(path, body, {
          timeoutMs: (picked.timeoutMs ?? 30000) + 65000,
        });
      try {
        if (!s.coachSession) {
          const session = await send<{ sessionId: string }>(
            "/api/quantum/session",
            { language: pickedLanguage, synthetic: true, llm: picked.id },
          );
          if (token !== s.epoch) {
            live.current
              .post("/api/reset", { sessionId: session.sessionId })
              .catch(() => {});
            return;
          }
          s.coachSession = session;
          render();
        }
        const result = await send<Feedback>("/api/quantum/explain", {
          sessionId: s.coachSession.sessionId,
          circuit: snapshot,
          question,
          prediction,
        });
        if (token !== s.epoch) return;
        s.feedback = result;
        s.exhausted = result.attemptsRemaining === 0;
      } catch (error) {
        if (token === s.epoch) {
          const e = error as RequestError;
          if (e.status === 404) s.coachSession = null;
          s.error = copy().coachError;
          s.exhausted = e.attemptsRemaining === 0;
        }
      } finally {
        if (token === s.epoch) {
          setBusy(false);
          render();
        }
      }
    }
    return {
      circuit,
      target,
      invalidateCoach,
      resetExperiment,
      go,
      ask,
      focusHeading,
      chooseLesson(id: string) {
        if (!s.busy) resetExperiment({ lesson: id });
      },
      predict(value: Prediction) {
        if (s.busy) return;
        s.prediction = value;
        s.guided = false;
        s.tested = false;
        s.step = 0;
        s.collapsed = null;
        s.counts = null;
        s.feedback = null;
        render();
      },
      test() {
        if (s.prediction && !s.busy) {
          s.tested = true;
          go(0);
        }
      },
      next() {
        if (s.busy || !s.tested) return;
        const model = circuit();
        if (s.step < model.frames.length - 1) go(s.step + 1);
        else {
          const index = quantumLessons.indexOf(s.config.lesson);
          if (index < 3) {
            resetExperiment({
              lesson: quantumLessons[index + 1],
              script: s.guided,
            });
            focusHeading();
          }
        }
      },
      prev() {
        if (!s.busy && s.step > 0) go(s.step - 1);
      },
      showcase() {
        if (s.busy) return;
        s.config = DEFAULT_CONFIG();
        resetExperiment({ script: true });
        focusHeading();
      },
      restart() {
        if (!s.busy) resetExperiment();
      },
      setting(key: "phase" | "basis" | "target", value: string) {
        if (s.busy) return;
        if (key === "basis") s.config.basis = value;
        else s.config[key] = Number(value);
        resetExperiment();
      },
      measure() {
        const model = circuit();
        if (!s.busy && s.tested && s.step === model.frames.length - 1) {
          s.collapsed = measureQuantum(
            s.collapsed?.state ?? model.frames[s.step].state,
          ) as Store["collapsed"];
          render();
        }
      },
      restore() {
        if (!s.busy) {
          s.collapsed = null;
          render();
        }
      },
      shots() {
        const model = circuit();
        if (!s.busy && s.tested && s.step === model.frames.length - 1) {
          s.collapsed = null;
          s.counts = sampleQuantum(model.frames[s.step].state) as number[];
          render();
        }
      },
      chooseModel(id: string) {
        if (s.busy) return;
        s.modelId = id;
        invalidateCoach();
        render();
      },
      newCoach() {
        if (!s.busy) {
          invalidateCoach();
          render();
        }
      },
    };
  }

  // Mirrors the controller's set(): hiding a busy lab or changing language
  // discards the pending reply; the provider list keeps the current model
  // when it still exists.
  const previousLanguage = useRef(language);
  useEffect(() => {
    if (!visible && s.busy) c.invalidateCoach();
    if (previousLanguage.current !== language) {
      c.invalidateCoach();
      previousLanguage.current = language;
    }
    const selected = s.modelId;
    s.modelId = status.models.some((t) => t.id === selected)
      ? selected
      : (status.defaultModel ?? status.models[0]?.id ?? "");
    render();
  }, [visible, language, status, c, s, render]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && s.busy) c.invalidateCoach();
      render();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [c, s, render]);
  useEffect(() => () => c.invalidateCoach(), [c]);

  const text = quantumCopy[language],
    zh = language === "zh",
    model = c.circuit(),
    lesson = quantumLesson(s.config.lesson, language),
    frame = model.frames[s.step],
    last = s.step === model.frames.length - 1,
    target = c.target(),
    state = (s.collapsed?.state ?? frame.state) as Amplitude[],
    probabilities = quantumProbabilities(state) as number[],
    coachReady = s.tested && last && Boolean(target?.configured),
    askDisabled = s.busy || !coachReady || s.exhausted,
    focusOf = s.feedback?.focus;
  const coachStatus = s.busy
    ? text.waiting
    : s.error
      ? s.error
      : !target?.configured
        ? text.coachUnavailable
        : !s.tested || !last
          ? zh
            ? "完成本实验的量子门后，可让模型解释结果。"
            : "Finish this circuit to ask about its checked result."
          : s.exhausted
            ? zh
              ? "本会话的 8 次请求已用完。"
              : "This session’s 8 requests have been used."
            : "";
  return (
    <div
      className="quantum-area lab-root"
      hidden={!visible}
      data-lesson={s.config.lesson}
      data-step={String(s.step)}
      data-guided={String(s.guided)}
    >
      <div className="quantum-hero">
        <p className="eyebrow" id="q-tag">
          {text.tag}
        </p>
        <h2 id="q-title">{text.title}</h2>
        <p id="q-intro">{text.intro}</p>
        <div className="quantum-actions">
          <button
            id="q-showcase"
            type="button"
            disabled={s.busy}
            onClick={c.showcase}
          >
            {text.start}
          </button>
          <span id="q-local" className="fine">
            {text.local}
          </span>
        </div>
      </div>
      <nav
        id="q-lessons"
        className="quantum-lessons"
        aria-label={zh ? "量子实验章节" : "Quantum experiments"}
      >
        {quantumLessons.map((id: string, i: number) => (
          <button
            key={id}
            type="button"
            className="example"
            aria-current={s.config.lesson === id ? "step" : "false"}
            disabled={s.busy}
            onClick={() => c.chooseLesson(id)}
          >
            {`${i + 1} · ${quantumLesson(id, language).short}`}
          </button>
        ))}
      </nav>
      <div className="quantum-layout">
        <section className="quantum-main">
          <div className="section-heading">
            <h3 id="q-heading" tabIndex={-1} ref={heading}>
              {lesson.title}
            </h3>
            <span id="q-progress" className="small-label">
              {`${text.progress} ${quantumLessons.indexOf(s.config.lesson) + 1}/4`}
            </span>
          </div>
          <div className="q-claim">
            <p className="eyebrow" id="q-claim-label">
              {text.claim}
            </p>
            <p id="q-claim">{lesson.claim}</p>
            <div id="q-choices" className="quantum-actions">
              {PREDICTIONS.map((value, i) => (
                <button
                  key={value}
                  type="button"
                  className="example"
                  aria-pressed={s.prediction === value}
                  disabled={s.busy}
                  onClick={() => c.predict(value)}
                >
                  {text.choices[i]}
                </button>
              ))}
            </div>
            <p id="q-prediction" className="fine">
              {s.guided
                ? text.guided
                : s.prediction
                  ? `${text.prediction}: ${text.choices[PREDICTIONS.indexOf(s.prediction)]}`
                  : text.choose}
            </p>
            <button
              id="q-test"
              type="button"
              hidden={s.tested}
              disabled={!s.prediction || s.busy}
              onClick={c.test}
            >
              {text.test}
            </button>
          </div>
          <div className="quantum-settings">
            <label
              id="q-phase-wrap"
              hidden={s.config.lesson !== "interference"}
            >
              <span id="q-phase-label">{text.phase}</span>
              <select
                id="q-phase"
                value={String(s.config.phase)}
                disabled={s.busy}
                onChange={(e) => c.setting("phase", e.target.value)}
              >
                <option value="0">0</option>
                <option value="1.5707963267948966">π/2</option>
                <option value="3.141592653589793">π</option>
              </select>
            </label>
            <label
              id="q-basis-wrap"
              hidden={s.config.lesson !== "entanglement"}
            >
              <span id="q-basis-label">{text.basis}</span>
              <select
                id="q-basis"
                value={s.config.basis}
                disabled={s.busy}
                onChange={(e) => c.setting("basis", e.target.value)}
              >
                <option value="Z">Z</option>
                <option value="X">X</option>
              </select>
            </label>
            <label id="q-target-wrap" hidden={s.config.lesson !== "search"}>
              <span id="q-target-label">{text.target}</span>
              <select
                id="q-target"
                value={String(s.config.target)}
                disabled={s.busy}
                onChange={(e) => c.setting("target", e.target.value)}
              >
                <option value="0">00</option>
                <option value="1">01</option>
                <option value="2">10</option>
                <option value="3">11</option>
              </select>
            </label>
          </div>
          <div id="q-experiment" hidden={!s.tested}>
            <div
              id="q-circuit"
              className={`q-circuit${focusOf === "circuit" ? " q-model-focus" : ""}`}
            >
              <CircuitDrawing model={model} step={s.step} language={language} />
            </div>
            <p id="q-story" className="q-story" role="status">
              {quantumFrameText(model, s.step, language)}
            </p>
            <div className="quantum-actions q-step-controls">
              <button
                id="q-prev"
                type="button"
                className="example"
                disabled={s.busy || s.step === 0}
                onClick={c.prev}
              >
                {text.prev}
              </button>
              <button
                id="q-next"
                type="button"
                disabled={s.busy || (last && s.config.lesson === "search")}
                onClick={c.next}
              >
                {last
                  ? s.config.lesson === "search"
                    ? zh
                      ? "展示完成"
                      : "Showcase complete"
                    : text.nextLesson
                  : `${text.next} → ${model.frames[s.step + 1]?.gate}`}
              </button>
              <button
                id="q-restart"
                type="button"
                className="text-button"
                disabled={s.busy}
                onClick={c.restart}
              >
                {text.restart}
              </button>
            </div>
            <div
              id="q-amplitudes"
              className={focusOf === "amplitudes" ? "q-model-focus" : undefined}
            >
              <h4 id="q-amplitude-title">
                {s.collapsed
                  ? zh
                    ? "本次测量后的状态"
                    : "State after this measurement"
                  : text.amplitudes}
              </h4>
              <div id="q-cards" className="q-state-cards">
                {model.labels.map((label: string, i: number) => {
                  const [re, im] = state[i],
                    visibleArrow = probabilities[i] > 1e-12,
                    x = 50 + 32 * re,
                    y = 44 - 32 * im;
                  return (
                    <article
                      className="q-state-card"
                      key={label}
                      data-basis={label}
                      data-probability={String(probabilities[i])}
                    >
                      <h5>{`|${label}⟩`}</h5>
                      <svg
                        viewBox="0 0 100 92"
                        role="img"
                        aria-label={`${text.amplitude} ${complex(state[i])}`}
                      >
                        <circle
                          cx={50}
                          cy={44}
                          r={32}
                          fill="#f4f3fb"
                          stroke="#d6d7e5"
                        />
                        <path
                          d="M 12 44 H 88 M 50 6 V 82"
                          stroke="#d6d7e5"
                          strokeWidth={1}
                        />
                        {visibleArrow ? (
                          <>
                            <line
                              x1={50}
                              y1={44}
                              x2={x}
                              y2={y}
                              stroke="#5151a0"
                              strokeWidth={3}
                              strokeLinecap="round"
                            />
                            <circle cx={x} cy={y} r={3} fill="#5151a0" />
                          </>
                        ) : (
                          <circle cx={50} cy={44} r={2} fill="#9da4b7" />
                        )}
                      </svg>
                      <span className="q-amplitude-number">
                        {`${text.amplitude} ${complex(state[i])}`}
                      </span>
                      <strong>{pct(probabilities[i])}</strong>
                      <small>{text.probability}</small>
                    </article>
                  );
                })}
              </div>
              <p id="q-amplitude-note" className="fine">
                {text.amplitudeNote}
              </p>
            </div>
            <div
              id="q-measurements"
              className={
                focusOf === "probabilities" ? "q-model-focus" : undefined
              }
            >
              <div className="quantum-actions">
                <button
                  id="q-measure"
                  type="button"
                  className="example"
                  disabled={s.busy || !last}
                  onClick={c.measure}
                >
                  {s.collapsed ? text.again : text.measure}
                </button>
                <button
                  id="q-shots"
                  type="button"
                  className="example"
                  disabled={s.busy || !last}
                  onClick={c.shots}
                >
                  {text.shots}
                </button>
                <button
                  id="q-restore"
                  type="button"
                  className="text-button"
                  hidden={!s.collapsed}
                  disabled={s.busy}
                  onClick={c.restore}
                >
                  {text.restore}
                </button>
              </div>
              <p id="q-observed" role="status">
                {s.collapsed
                  ? `${text.observed}: |${model.labels[s.collapsed.outcome]}⟩`
                  : ""}
              </p>
              <p id="q-collapse-note" className="fine" hidden={!s.collapsed}>
                {text.collapse}
              </p>
              <div id="q-counts" hidden={!s.counts}>
                {s.counts && (
                  <>
                    <h4>{text.histogram}</h4>
                    <Bars
                      probabilities={frame.probabilities as number[]}
                      labels={model.labels as string[]}
                      observations={s.counts}
                      theory={text.theory}
                    />
                    <p className="fine">{text.readout}</p>
                  </>
                )}
              </div>
              <div id="q-reference" hidden={!frame.reference}>
                {frame.reference && (
                  <>
                    <h4>{text.reference}</h4>
                    <Bars
                      probabilities={frame.reference as number[]}
                      labels={model.labels as string[]}
                      theory={text.theory}
                    />
                    <p className="fine">{text.referenceNote}</p>
                  </>
                )}
              </div>
            </div>
          </div>
          <details className="q-details">
            <summary id="q-details-title">{text.details}</summary>
            <p id="q-why">{lesson.why}</p>
            <p id="q-hardware">{text.hardware}</p>
            <p id="q-limits">{text.limits}</p>
          </details>
        </section>
        <aside className="quantum-aside">
          <section className="q-coach">
            <h3 id="q-coach-title">{text.coach}</h3>
            <label className="q-model-label">
              <span id="q-model-label">
                {zh ? "提供商 / 模型" : "Provider / model"}
              </span>
              <select
                id="q-model"
                value={s.modelId}
                disabled={s.busy}
                onChange={(e) => c.chooseModel(e.target.value)}
              >
                {status.models.map((t) => (
                  <option key={t.id} value={t.id} disabled={!t.configured}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="q-coach-note" className="fine">
              {text.coachNote}
            </p>
            <div className="quantum-actions">
              <button
                type="button"
                id="q-ask"
                disabled={askDisabled}
                onClick={() => void c.ask("why")}
              >
                {text.ask}
              </button>
              <button
                type="button"
                id="q-challenge"
                className="example"
                disabled={askDisabled}
                onClick={() => void c.ask("claim")}
              >
                {text.compare}
              </button>
            </div>
            <p id="q-coach-status" role="status">
              {coachStatus}
            </p>
            <p id="q-coach-answer">
              {s.feedback
                ? `${text.coachPrefix} · ${target?.label ?? ""}\n${s.feedback.explanation}`
                : ""}
            </p>
            <p id="q-coach-next">{s.feedback?.nextQuestion ?? ""}</p>
            <button
              type="button"
              className="example"
              id="q-new-coach"
              hidden={!s.exhausted}
              disabled={s.busy}
              onClick={c.newCoach}
            >
              {zh ? "开始新的解释会话" : "New explanation session"}
            </button>
          </section>
          <ProviderConsole
            post={post}
            language={language}
            enabled={status.traceEnabled && visible}
            sessionId={s.coachSession?.sessionId ?? null}
            busy={s.busy}
            className="lab-console"
          />
          <details className="q-details">
            <summary id="q-sources-title">{text.sources}</summary>
            <p id="q-baseline" className="fine">
              {text.baseline}
            </p>
            <ul id="q-sources">
              {SOURCES.map(([label, url]) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </aside>
      </div>
    </div>
  );
}
