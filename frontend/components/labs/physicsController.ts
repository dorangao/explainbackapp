import type { RefObject } from "react";
import {
  demoPresentation,
  defaultSuctionFocus,
} from "../../../public/presentation.mjs";
import { runSuctionDemo } from "../../../public/suction-demo.mjs";
import { poweredJourneyScenario as journeyScenario } from "../../../public/powered-journey.mjs";
import { demoPresets } from "../../../public/demo-presets.mjs";
import { runPresetDemo, demoSettings } from "../../../public/demo-runner.mjs";
import { drawFlightView, flightReadout } from "../../../public/flight-view.mjs";
import { drawGraph } from "../../../public/function-plot.mjs";
import { evaluate } from "../../../public/formula-catalog.mjs";
import { physicsAt } from "../../../public/motion.mjs";
import { drawMotionGraph } from "../../../public/motion-graph.mjs";
import { renderPhysicsPanel } from "../../../public/physics-panel.mjs";
import type { JourneyHandle, SuctionHandle } from "./mounted";
import { t, examples, vehicleExamples, type Topic } from "./physicsCopy";
import type {
  DemoPreset,
  EvidenceRecord,
  Language,
  LabProps,
  RequestError,
  Session,
} from "./types";

export type Settings = {
  motionSpeed: string;
  motionDuration: string;
  motionProfile: string;
  motionMass: string;
  motionGrip: string;
  motionPower: string;
  flightMass: string;
  flightTime: string;
  flightRadius: string;
  flightSeparation: string;
  flightStop: string;
  flightProfile: string;
};
export const defaultSettings = (): Settings => ({
  motionSpeed: "60",
  motionDuration: "5",
  motionProfile: "smooth",
  motionMass: "2000",
  motionGrip: "1",
  motionPower: "600",
  flightMass: "2000",
  flightTime: "1.5",
  flightRadius: "0.9",
  flightSeparation: "1",
  flightStop: "0.3",
  flightProfile: "pulse",
});
type AutoRun = {
  controller: AbortController;
  version: number;
  language: Language;
};
export type AutoState =
  "idle" | "running" | "complete" | "stopped" | "attention";
export type Store = {
  session: Session | null;
  generation: number;
  busy: boolean;
  polling: boolean;
  traceRefresh: number;
  ready: boolean;
  workspaceVisible: boolean;
  sessionInterrupted: boolean;
  demoPresetUsed: boolean;
  journeyModel: any;
  modelId: string;
  experienceMode: "demo" | "manual";
  guidedDemo: boolean;
  autoEvidence: boolean;
  autoWaiting: boolean;
  autoGate: { next: () => void } | null;
  autoRun: AutoRun | null;
  autoState: AutoState;
  autoStage: string;
  autoCalls: number;
  autoStopReason: string;
  topic: Topic;
  demoKind: "vehicle" | "suction";
  demoPreset: string;
  settings: Settings;
  explanation: string;
  transferA: string;
  transferB: string;
  scrubber: number;
  scrubberScenario: string | null;
  motionMetric: string;
  flightMetric: string;
  notice: string;
  error: string | null;
  replayStatus: string;
  autoDemoPrompt: string;
  autoDemoFeedback: string;
  autoDemoPreview: boolean;
  sessionRecordOpen: boolean;
  consoleOpen: boolean;
  consoleHost: "area" | "auto";
  animationHost: "home" | "journey" | "suction";
  playbackFrame: number | null;
  playbackLast: number;
  after: Array<() => void>;
  destroyed: boolean;
};
export const createStore = (): Store => ({
  session: null,
  generation: 0,
  busy: false,
  polling: false,
  traceRefresh: 0,
  ready: false,
  workspaceVisible: false,
  sessionInterrupted: false,
  demoPresetUsed: false,
  journeyModel: null,
  modelId: "",
  experienceMode: "demo",
  guidedDemo: false,
  autoEvidence: false,
  autoWaiting: false,
  autoGate: null,
  autoRun: null,
  autoState: "idle",
  autoStage: "",
  autoCalls: 0,
  autoStopReason: "",
  topic: "suction",
  demoKind: "suction",
  demoPreset: "0",
  settings: defaultSettings(),
  explanation: "",
  transferA: "",
  transferB: "",
  scrubber: 0,
  scrubberScenario: null,
  motionMetric: "velocity",
  flightMetric: "torque",
  notice: "",
  error: null,
  replayStatus: "",
  autoDemoPrompt: "",
  autoDemoFeedback: "",
  autoDemoPreview: false,
  sessionRecordOpen: false,
  consoleOpen: false,
  consoleHost: "area",
  animationHost: "home",
  playbackFrame: null,
  playbackLast: 0,
  after: [],
  destroyed: false,
});
export type Dom = {
  graph: RefObject<HTMLDivElement | null>;
  flightScene: RefObject<HTMLDivElement | null>;
  flightPanel: RefObject<HTMLElement | null>;
  physicsPanel: RefObject<HTMLElement | null>;
  explanation: RefObject<HTMLTextAreaElement | null>;
  feedback: RefObject<HTMLElement | null>;
  topic: RefObject<HTMLSelectElement | null>;
  autoDemo: RefObject<HTMLElement | null>;
};
const CLAIM_TOPICS = ["crossing", "acceleration", "flight", "suction"];
const DEMO_SETTINGS: Settings = {
  motionSpeed: "60",
  motionDuration: "5",
  motionProfile: "smooth",
  motionMass: "2000",
  motionGrip: "1",
  motionPower: "600",
  flightMass: "2000",
  flightTime: "1.5",
  flightRadius: "0.9",
  flightSeparation: "1",
  flightStop: "0.3",
  flightProfile: "pulse",
};
const isAbort = (error: unknown) =>
  (error as { name?: string })?.name === "AbortError";

export function createPhysicsController(
  s: Store,
  render: () => void,
  live: { current: LabProps },
  dom: Dom,
) {
  let journey: JourneyHandle | null = null,
    suction: SuctionHandle | null = null;
  const language = () => live.current.language;
  const zh = () => language() === "zh";
  const send = <T>(
    path: string,
    body: unknown,
    options?: { timeoutMs?: number },
  ) => live.current.post<T>(path, body, options);
  const selectedTarget = () =>
    live.current.status.models.find((target) => target.id === s.modelId);
  const autoActive = () =>
    Boolean(s.autoRun && !s.autoRun.controller.signal.aborted);
  const currentTopic = () => s.session?.problem.id || s.topic;
  const suctionMode = () => currentTopic() === "suction";
  const flightMode = () => currentTopic() === "flight";
  const motionMode = () => currentTopic() === "acceleration";
  const suctionDemoMode = () => s.demoKind === "suction";
  const stopPolling = () => {
    s.polling = false;
  };
  function suctionOptions() {
    return {
      session: s.session,
      language: language(),
      visible: suctionMode(),
      preview: s.guidedDemo ? !s.autoEvidence : !s.session?.graph,
      locked: s.busy || autoActive(),
      primaryReference: s.guidedDemo,
      focus: s.guidedDemo
        ? demoPresentation(s.autoStage, language(), true).focus
        : defaultSuctionFocus(s.session),
    };
  }
  const syncSuction = () => suction?.set(suctionOptions());
  function journeyOptions() {
    return {
      scenario: s.journeyModel,
      visible:
        (s.guidedDemo && !suctionDemoMode()) ||
        Boolean(
          s.session?.graph &&
          s.journeyModel &&
          s.session.phase !== "transfer" &&
          (motionMode() || flightMode()),
        ),
      language: language(),
      busy: s.busy,
      locked: autoActive(),
      preview: s.guidedDemo && !s.autoEvidence,
    };
  }
  const syncJourney = () => journey?.set(journeyOptions());
  function readJourney() {
    const v = s.settings;
    return journeyScenario(
      {
        speedMph: Number(v.motionSpeed),
        duration: Number(v.motionDuration),
        profileB: v.motionProfile,
        massKg: Number(v.motionMass),
        grip: Number(v.motionGrip),
        powerKw: Number(v.motionPower),
      },
      {
        massKg: Number(v.flightMass),
        airtime: Number(v.flightTime),
        radius: Number(v.flightRadius),
        separation: Number(v.flightSeparation),
        stopTime: Number(v.flightStop),
        landingProfile: v.flightProfile,
      },
    );
  }
  const presets = (): DemoPreset[] =>
    demoPresets(s.session, language()) as DemoPreset[];
  // renderDemo(): the declarative parts are computed in JSX; the mounted
  // journey and suction views are driven here, as in the original.
  function renderDemo() {
    const options = presets();
    if (!options[Number(s.demoPreset)]) s.demoPreset = "0";
    syncJourney();
    if (suctionDemoMode() && s.guidedDemo) syncSuction();
    render();
  }
  function stopAutoDemo(reason = "stop") {
    stopPolling();
    if (!autoActive()) return;
    s.autoStopReason = reason;
    s.autoState = "stopped";
    s.autoRun!.controller.abort();
    journey?.stop();
    suction?.stop();
    controls();
  }
  function demoCheckpoint(_stage: string, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Stopped", "AbortError"));
        return;
      }
      const gate = { next: () => finish(true) };
      const cancel = () => finish(false);
      const finish = (ok: boolean) => {
        if (s.autoGate !== gate) return;
        s.autoGate = null;
        s.autoWaiting = false;
        signal.removeEventListener("abort", cancel);
        render();
        if (ok) resolve();
        else reject(new DOMException("Stopped", "AbortError"));
      };
      s.autoGate = gate;
      s.autoWaiting = true;
      signal.addEventListener("abort", cancel, { once: true });
      render();
    });
  }
  function drawCurrentGraph() {
    syncSuction();
    const graph = dom.graph.current,
      scene = dom.flightScene.current,
      flightPanel = dom.flightPanel.current,
      physicsPanel = dom.physicsPanel.current;
    if (!graph || !scene || !flightPanel || !physicsPanel) return;
    graph.hidden = suctionMode();
    if (suctionMode()) {
      scene.hidden = true;
      flightPanel.hidden = true;
      physicsPanel.hidden = true;
      return;
    }
    const data = s.session?.graph;
    if (flightMode())
      drawFlightView(
        scene,
        graph,
        flightPanel,
        data,
        language(),
        s.scrubber,
        s.flightMetric,
      );
    else if (motionMode())
      drawMotionGraph(graph, data, language(), s.scrubber, s.motionMetric);
    else drawGraph(graph, data, language(), s.scrubber);
    if (!flightMode()) {
      scene.hidden = true;
      flightPanel.hidden = true;
      graph.classList.remove("flight-plot");
    }
    renderPhysicsPanel(
      physicsPanel,
      motionMode() ? data : null,
      language(),
      s.scrubber,
    );
  }
  function controls() {
    live.current.onBusy(s.busy || autoActive());
    if (s.busy) {
      stopPlayback();
      journey?.stop();
    }
    if (suctionMode()) syncSuction();
    render();
  }
  async function post<T = any>(
    path: string,
    body: Record<string, unknown>,
    { timeoutMs }: { timeoutMs?: number } = {},
  ): Promise<T> {
    if (s.destroyed) throw new DOMException("Unmounted", "AbortError");
    if (path === "/api/session") body = { ...body, llm: s.modelId };
    const value = await send<T>(path, body, {
      timeoutMs:
        timeoutMs ??
        (s.session?.llm?.timeoutMs ?? selectedTarget()?.timeoutMs ?? 30000) +
          65000,
    });
    if (s.destroyed) throw new DOMException("Unmounted", "AbortError");
    return value;
  }
  function showError(message: string) {
    s.error = message;
    if (s.guidedDemo)
      s.autoDemoFeedback =
        (zh() ? "本步未完成：" : "This step did not complete: ") + message;
  }
  function renderSession() {
    stopPlayback();
    journey?.stop();
    renderDemo();
    const session = s.session;
    if (session) {
      const { phase, problem, graph } = session;
      if (flightMode() && graph) {
        if (s.scrubberScenario !== graph.scenario.id) {
          s.scrubber = 0;
          s.scrubberScenario = graph.scenario.id;
        }
      } else if (motionMode() && graph) {
        if (s.scrubberScenario !== graph.scenario.id) {
          s.scrubber = 0;
          s.scrubberScenario = graph.scenario.id;
        }
      }
      if (phase === "transfer" && problem.purpose)
        s.notice = `${zh() ? "这道题检验什么：" : "What this variant tests: "}${problem.purpose}`;
    }
    drawCurrentGraph();
    controls();
  }
  function pointValue(): string {
    const graph = s.session?.graph;
    if (!graph || suctionMode()) return "";
    if (flightMode())
      return flightReadout(
        graph.scenario,
        s.scrubber,
        s.flightMetric,
        language(),
      );
    if (motionMode()) {
      const scenario = graph.scenario,
        time = s.scrubber,
        metric = s.motionMetric;
      const unit = {
        velocity: "m/s",
        acceleration: "m/s²",
        distance: "m",
        force: "kN",
        powerKw: "kW",
        jerk: "m/s³",
      }[metric];
      const value = (profile: string) =>
        (physicsAt(scenario, profile, time) as Record<string, number>)[metric] /
        (metric === "force" ? 1000 : 1);
      return `t = ${Number(time.toFixed(3))} s · A = ${value("uniform").toFixed(3)} ${unit} · B = ${value(scenario.profileB).toFixed(3)} ${unit}`;
    }
    const x = s.scrubber,
      y = evaluate(graph.formula, x);
    return `x = ${x.toFixed(1)} → y = ${y.toFixed(4)}`;
  }
  function updatePoint() {
    if (!s.session?.graph || suctionMode()) {
      render();
      return;
    }
    drawCurrentGraph();
    render();
  }
  function clear({ remote = true }: { remote?: boolean } = {}) {
    stopAutoDemo("reset");
    s.sessionRecordOpen = false;
    s.guidedDemo = false;
    s.autoEvidence = false;
    s.autoWaiting = false;
    suction?.stop();
    s.animationHost = "home";
    if (s.autoState !== "stopped") {
      s.autoState = "idle";
      s.autoStage = "";
      s.autoCalls = 0;
      s.autoStopReason = "";
    }
    s.autoDemoPreview = false;
    s.autoDemoPrompt = "";
    s.autoDemoFeedback = "";
    stopPlayback();
    journey?.stop();
    s.generation++;
    s.demoPresetUsed = false;
    s.journeyModel = null;
    if (s.session && remote)
      post("/api/reset", { sessionId: s.session.sessionId }).catch(() => {});
    // The rendered learner/provider content disappears with the session;
    // a shared tester browser must not retain a previous sign-in's transcript.
    s.session = null;
    s.busy = false;
    s.sessionInterrupted = false;
    s.explanation = "";
    s.transferA = "";
    s.transferB = "";
    s.replayStatus = "";
    s.scrubber = 0;
    s.scrubberScenario = null;
    s.motionMetric = "velocity";
    s.flightMetric = "torque";
    s.error = null;
    s.notice = t(language()).newSession;
    drawCurrentGraph();
    renderSession();
  }
  function stopPlayback() {
    if (s.playbackFrame !== null) cancelAnimationFrame(s.playbackFrame);
    s.playbackFrame = null;
    s.playbackLast = 0;
  }
  async function runDemo() {
    if (!s.ready || s.busy || autoActive()) return;
    const isSuctionDemo = suctionDemoMode();
    clear();
    s.topic = isSuctionDemo ? "suction" : "flight";
    s.settings = { ...DEMO_SETTINGS };
    s.journeyModel = journeyScenario(demoSettings.motion, demoSettings.flight);
    s.demoPresetUsed = true;
    s.guidedDemo = true;
    s.autoEvidence = false;
    s.animationHost = isSuctionDemo ? "suction" : "journey";
    const run: AutoRun = {
      controller: new AbortController(),
      version: ++s.generation,
      language: language(),
    };
    s.autoRun = run;
    s.autoState = "running";
    s.autoStage = "start";
    s.autoCalls = 0;
    s.autoStopReason = "";
    s.consoleHost = "auto";
    s.consoleOpen = false;
    s.autoDemoPreview = true;
    s.autoDemoPrompt = "";
    s.autoDemoFeedback = "";
    localize();
    renderSession();
    s.after.push(() =>
      dom.autoDemo.current?.scrollIntoView({ block: "start" }),
    );
    const current = () => run.version === s.generation && s.autoRun === run;
    const request = async (path: string, body: Record<string, unknown>) => {
      if (run.controller.signal.aborted)
        throw new DOMException("Stopped", "AbortError");
      s.busy = true;
      if (path === "/api/turn") s.autoCalls++;
      controls();
      if (path === "/api/turn") s.polling = true;
      try {
        const result = await post(path, body);
        if (
          path === "/api/session" &&
          (!current() || run.controller.signal.aborted)
        )
          post("/api/reset", { sessionId: result.sessionId }).catch(() => {});
        return result;
      } catch (error) {
        const e = error as RequestError;
        if (current() && s.session && Number.isInteger(e.attemptsRemaining))
          s.session.attemptsRemaining = e.attemptsRemaining as number;
        throw error;
      } finally {
        s.polling = false;
        if (current()) {
          s.busy = false;
          controls();
          renderDemo();
          s.traceRefresh++;
          render();
        }
      }
    };
    const runner = isSuctionDemo ? runSuctionDemo : runPresetDemo;
    try {
      await runner({
        language: run.language,
        testerAuthenticated: true,
        signal: run.controller.signal,
        request,
        checkpoint: demoCheckpoint,
        step: (stage: string) => {
          if (!current()) return;
          s.autoStage = stage;
          if (stage === "complete") s.autoState = "complete";
          render();
        },
        show: (data: Session, preset?: DemoPreset) => {
          if (!current()) return;
          s.session = data;
          if (data.graph) s.autoEvidence = true;
          renderSession();
          if (preset) {
            s.explanation = preset.text;
            s.autoDemoPrompt = preset.text;
            if (data.phase === "transfer")
              data.answerFields?.forEach((field, i) => {
                const value = String(preset.answer?.[field.key] ?? "");
                if (i === 0) s.transferA = value;
                else s.transferB = value;
              });
          }
          const feedback =
            data.phase === "confirm"
              ? data.claim?.interpretation
              : data.history.at(-1)?.feedback;
          s.autoDemoFeedback = feedback
            ? `${data.llm?.label ?? "Model"} · ${feedback}`
            : "";
          s.traceRefresh++;
          render();
        },
        play: async (signal: AbortSignal, stage: string) => {
          if (isSuctionDemo) return suction?.play(signal, stage) ?? false;
          const ranges: Record<string, [number, number, number]> = {
            acceleration: [0, s.journeyModel.launch, 0.5],
            flip: [s.journeyModel.launch, s.journeyModel.landing, 0.25],
            landing: [s.journeyModel.landing, s.journeyModel.end, 0.25],
          };
          const [from, to, rate] = ranges[stage];
          return journey?.playRange({ signal, from, to, rate }) ?? false;
        },
      });
    } catch (error) {
      if (current()) {
        s.autoState = isAbort(error) ? "stopped" : "attention";
        if (!isAbort(error))
          showError(
            zh()
              ? "演示在此停止，请检查模型反馈或连接状态；不会自动重试。"
              : (error as Error).message,
          );
      }
    } finally {
      if (current()) {
        s.autoRun = null;
        s.busy = false;
        journey?.stop();
        suction?.stop();
        controls();
        renderDemo();
        s.traceRefresh++;
        render();
      }
    }
  }
  // localize(): copy is derived in JSX; redraw, stop playback and resync.
  function localize() {
    drawCurrentGraph();
    stopPlayback();
    renderDemo();
  }
  function continueManually() {
    if (!s.guidedDemo || autoActive()) return;
    s.guidedDemo = false;
    s.autoEvidence = false;
    s.autoWaiting = false;
    s.autoStage = "";
    s.autoState = "idle";
    s.autoStopReason = "";
    s.animationHost = "home";
    s.autoDemoPreview = false;
    renderDemo();
  }
  function chooseExperience(mode: "demo" | "manual") {
    if (s.busy) return;
    if (mode === "manual") {
      stopAutoDemo();
      continueManually();
    }
    s.experienceMode = mode;
    if (mode === "demo") s.sessionRecordOpen = false;
    s.consoleHost = mode === "manual" ? "area" : "auto";
    drawCurrentGraph();
    renderSession();
  }
  function focusExplanation() {
    s.after.push(() => dom.explanation.current?.focus());
  }
  function setExplanation(value: string) {
    s.explanation = value;
    render();
  }
  return {
    pointValue,
    autoActive,
    suctionMode,
    flightMode,
    motionMode,
    suctionDemoMode,
    presets,
    selectedTarget,
    registerJourney(handle: JourneyHandle | null) {
      journey = handle;
      if (handle) handle.set(journeyOptions());
    },
    registerSuction(handle: SuctionHandle | null) {
      suction = handle;
      if (handle) handle.set(suctionOptions());
    },
    // set(): called from the React effect that mirrors prop changes.
    applyProps(previousLanguage: Language) {
      if (s.destroyed) return;
      const { visible, language: next, status } = live.current;
      s.workspaceVisible = visible;
      const selected = s.modelId;
      s.modelId = status.models.some((target) => target.id === selected)
        ? selected
        : (status.defaultModel ?? status.models[0]?.id ?? "");
      s.ready = Boolean(selectedTarget()?.configured);
      if (previousLanguage !== next) languageChanged();
      if (!visible) {
        stopAutoDemo("hidden");
        stopPlayback();
        journey?.stop();
        suction?.stop();
      }
      localize();
      controls();
    },
    stop() {
      stopAutoDemo("hidden");
      stopPlayback();
      journey?.stop();
      suction?.stop();
    },
    destroy() {
      const id = s.session?.sessionId;
      clear({ remote: false });
      s.destroyed = true;
      if (id) void send("/api/reset", { sessionId: id }).catch(() => {});
      live.current.onBusy(false);
    },
    onVisibilityChange() {
      if (document.hidden) {
        stopAutoDemo("hidden");
        stopPlayback();
      }
      renderDemo();
    },
    chooseModel(id: string) {
      s.modelId = id;
      s.ready = Boolean(selectedTarget()?.configured);
      localize();
      controls();
    },
    chooseDemoKind(kind: "vehicle" | "suction") {
      s.demoKind = kind;
      clear();
      s.topic = suctionDemoMode() ? "suction" : "flight";
      localize();
    },
    chooseTopic(topic: Topic) {
      s.topic = topic;
      s.demoKind = topic === "suction" ? "suction" : "vehicle";
      localize();
    },
    chooseVehicleStage(topic: "acceleration" | "flight") {
      if (s.busy) return;
      if (currentTopic() === topic) return;
      clear();
      s.topic = topic;
      localize();
      controls();
    },
    chooseExperience,
    continueManually,
    runDemo,
    stopDemo: () => stopAutoDemo(),
    demoNext(detail: number) {
      if (detail > 1 || s.busy) return;
      if (s.autoState === "complete" && !autoActive()) {
        void runDemo();
        return;
      }
      if (autoActive()) s.autoGate?.next();
    },
    async start() {
      if (s.busy || s.session) return;
      s.busy = true;
      controls();
      const version = ++s.generation;
      const v = s.settings,
        topic = s.topic;
      try {
        if (motionMode() || flightMode()) s.journeyModel = readJourney();
        const data = await post<Session>("/api/session", {
          problemId: topic,
          language: language(),
          synthetic: true,
          workflow: CLAIM_TOPICS.includes(topic) ? "claim-testing" : "baseline",
          ...(topic === "flight"
            ? {
                flight: {
                  massKg: Number(v.flightMass),
                  airtime: Number(v.flightTime),
                  radius: Number(v.flightRadius),
                  separation: Number(v.flightSeparation),
                  stopTime: Number(v.flightStop),
                  landingProfile: v.flightProfile,
                },
              }
            : {}),
          ...(topic === "acceleration"
            ? {
                motion: {
                  speedMph: Number(v.motionSpeed),
                  duration: Number(v.motionDuration),
                  profileB: v.motionProfile,
                  massKg: Number(v.motionMass),
                  grip: Number(v.motionGrip),
                  powerKw: Number(v.motionPower),
                },
              }
            : {}),
        });
        if (version !== s.generation) {
          void send("/api/reset", { sessionId: data.sessionId }).catch(
            () => {},
          );
          return;
        }
        s.session = data;
        s.notice = zh()
          ? "虚构示例；不输入真实个人或学生信息。"
          : "Synthetic example; keep real personal and student information out.";
        s.error = null;
        renderSession();
        focusExplanation();
      } catch (error) {
        if (version === s.generation) {
          s.notice = (error as Error).message;
          render();
        }
      } finally {
        if (version === s.generation) {
          s.busy = false;
          controls();
          focusExplanation();
        }
      }
    },
    async submit() {
      if (s.busy || s.sessionInterrupted || !s.session || autoActive()) return;
      continueManually();
      const explanation = s.explanation.trim();
      if (!explanation) return;
      let answer: Record<string, number> | undefined;
      const session = s.session;
      if (
        session.workflow === "claim-testing" &&
        session.phase === "transfer"
      ) {
        const a = s.transferA,
          b = s.transferB;
        if (Boolean(a) !== Boolean(b)) {
          showError(t(language())["values-note"]);
          render();
          return;
        }
        if (a && b)
          answer = Object.fromEntries(
            (session.answerFields ?? []).map((field, i) => [
              field.key,
              Number(i === 0 ? a : b),
            ]),
          );
      }
      s.busy = true;
      controls();
      s.error = null;
      const version = s.generation;
      try {
        const data = await post<Session>("/api/turn", {
          sessionId: session.sessionId,
          explanation,
          demoPreset: s.demoPresetUsed,
          ...(answer ? { answer } : {}),
        });
        if (version !== s.generation) return;
        s.session = data;
        s.explanation = "";
        renderSession();
        s.after.push(() => dom.feedback.current?.focus());
      } catch (error) {
        if (version === s.generation) {
          const e = error as RequestError;
          if (Number.isInteger(e.attemptsRemaining)) {
            session.attemptsRemaining = e.attemptsRemaining as number;
            renderSession();
          }
          showError(
            e.name === "TimeoutError"
              ? zh()
                ? "请求超时。文本已保留，请稍后手动重试。"
                : "Request timed out. Your text is preserved; retry explicitly after the current request finishes."
              : e.message,
          );
        }
      } finally {
        if (version === s.generation) {
          s.busy = false;
          controls();
          renderDemo();
          s.traceRefresh++;
          render();
        }
      }
    },
    async decideClaim(decision: "confirm" | "revise") {
      if (
        s.busy ||
        s.sessionInterrupted ||
        s.session?.phase !== "confirm" ||
        autoActive()
      )
        return;
      continueManually();
      const session = s.session,
        version = s.generation,
        previous = session.claim?.quote ?? "";
      s.busy = true;
      controls();
      s.error = null;
      try {
        const data = await post<Session>("/api/claim", {
          sessionId: session.sessionId,
          claimId: session.claim?.id,
          decision,
        });
        if (version !== s.generation) return;
        s.session = data;
        s.explanation = decision === "revise" ? previous : "";
        renderSession();
        focusExplanation();
      } catch (error) {
        if (version === s.generation) {
          showError((error as Error).message);
          render();
        }
      } finally {
        if (version === s.generation) {
          s.busy = false;
          controls();
        }
      }
    },
    async replay(record: EvidenceRecord, setPending: (v: boolean) => void) {
      if (s.busy || !s.session) return;
      const version = s.generation;
      setPending(true);
      try {
        const result = await post<{ verified: boolean }>("/api/replay", {
          sessionId: s.session.sessionId,
          evidenceId: record.id,
        });
        if (version === s.generation)
          s.replayStatus = result.verified
            ? `${zh() ? "重放核验通过；未调用模型。" : "Replay verified; no model call."} ${record.id}`
            : zh()
              ? "重放未通过。"
              : "Replay failed.";
      } catch (error) {
        if (version === s.generation) showError((error as Error).message);
      } finally {
        setPending(false);
        render();
      }
    },
    setExplanation,
    setTransfer(index: 0 | 1, value: string) {
      if (index === 0) s.transferA = value;
      else s.transferB = value;
      render();
    },
    loadPreset() {
      if (s.busy || !s.session) return;
      const preset = presets()[Number(s.demoPreset)];
      if (!preset) return;
      s.demoPresetUsed = true;
      s.explanation = preset.text;
      if (s.session.phase === "transfer")
        s.session.answerFields?.forEach((field, i) => {
          const value = String(preset.answer?.[field.key] ?? "");
          if (i === 0) s.transferA = value;
          else s.transferB = value;
        });
      renderDemo();
      focusExplanation();
    },
    choosePreset(value: string) {
      s.demoPreset = value;
      render();
    },
    setSetting(key: keyof Settings, value: string) {
      s.settings[key] = value;
      if (key === "motionMass") s.settings.flightMass = value;
      if (key === "flightMass") s.settings.motionMass = value;
      render();
    },
    reset: () => clear(),
    again() {
      clear();
      s.after.push(() => dom.topic.current?.focus());
    },
    scrub(value: number) {
      stopPlayback();
      s.scrubber = value;
      updatePoint();
    },
    chooseMetric(kind: "motion" | "flight", value: string) {
      if (kind === "motion") s.motionMetric = value;
      else s.flightMetric = value;
      updatePoint();
    },
    useExample(index: 0 | 1) {
      if (!s.session || s.busy) return;
      s.demoPresetUsed = true;
      s.explanation = suctionMode()
        ? index === 0
          ? zh()
            ? "这个空气动力让它安全吗？"
            : "Does this air power make it safe?"
          : presets()[0].text
        : examples[s.session.problem.id][language()][index];
      renderDemo();
      focusExplanation();
    },
    useVehicleExample(id: keyof typeof vehicleExamples) {
      if (!s.session || s.busy) return;
      s.demoPresetUsed = true;
      s.explanation = vehicleExamples[id][zh() ? 1 : 0];
      renderDemo();
      focusExplanation();
    },
    togglePlayback(max: number) {
      if (s.playbackFrame !== null) {
        stopPlayback();
        render();
        return;
      }
      if (!flightMode() || !s.session?.graph || s.busy) return;
      if (s.scrubber >= max) s.scrubber = 0;
      let simulated = s.scrubber;
      const tick = (now: number) => {
        if (!flightMode() || !s.session?.graph || s.busy) {
          stopPlayback();
          render();
          return;
        }
        if (!s.playbackLast) s.playbackLast = now;
        simulated = Math.min(max, simulated + (now - s.playbackLast) / 3000);
        s.playbackLast = now;
        s.scrubber = simulated;
        updatePoint();
        if (simulated >= max) {
          stopPlayback();
          render();
          return;
        }
        s.playbackFrame = requestAnimationFrame(tick);
      };
      s.playbackFrame = requestAnimationFrame(tick);
      render();
    },
    toggleConsole(open: boolean) {
      s.consoleOpen = open;
      render();
    },
    toggleSessionRecord(open: boolean) {
      s.sessionRecordOpen = open;
      render();
    },
  };
  function languageChanged() {
    const interrupted = s.busy && !autoActive();
    if (interrupted) {
      s.generation++;
      s.busy = false;
      s.sessionInterrupted = Boolean(s.session);
      if (s.session)
        void send("/api/reset", { sessionId: s.session.sessionId }).catch(
          () => {},
        );
    }
    // Language changes translate local teaching UI without discarding
    // evidence or time. A scripted provider run keeps its original request
    // language, so pause it here.
    stopAutoDemo("language");
    localize();
    renderSession();
    controls();
    if (interrupted)
      s.notice = zh()
        ? "已丢弃待处理的回复，已接受的证据仍保留。重置会话后可用新语言继续。"
        : "Pending reply discarded; accepted evidence is preserved. Reset the session to continue in the new language.";
    else if (s.session)
      s.notice = zh()
        ? "已保留进度。已有模型文本仍使用请求时的语言；重新开始可切换模型回复语言。"
        : "Progress preserved. Existing provider text keeps its request language; restart for provider replies in the new language.";
  }
}
export type PhysicsController = ReturnType<typeof createPhysicsController>;
