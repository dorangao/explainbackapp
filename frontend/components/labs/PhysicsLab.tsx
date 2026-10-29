import { useEffect, useRef } from "react";
import { demoPresentation } from "../../../public/presentation.mjs";
import { ProviderConsole } from "../ProviderConsole";
import { useLabStore, useAfterRender } from "./useLabStore";
import {
  createPhysicsController,
  createStore,
  type Dom,
} from "./physicsController";
import { t, topics, topicLabels, provenanceText } from "./physicsCopy";
import { JourneyView, SuctionLabView } from "./mounted";
import { GuidedDemo } from "./GuidedDemo";
import { MotionSettings } from "./MotionSettings";
import { Workspace } from "./Workspace";
import type { LabProps } from "./types";
import type { View } from "./view";
import "../../labs.css";

export function PhysicsLab(props: LabProps) {
  const { language, visible, status, post, onLanguage } = props;
  const [s, render] = useLabStore(createStore);
  useAfterRender(s.after);
  const live = useRef(props);
  live.current = props;
  const dom: Dom = {
    graph: useRef<HTMLDivElement>(null),
    flightScene: useRef<HTMLDivElement>(null),
    flightPanel: useRef<HTMLElement>(null),
    physicsPanel: useRef<HTMLElement>(null),
    explanation: useRef<HTMLTextAreaElement>(null),
    feedback: useRef<HTMLElement>(null),
    topic: useRef<HTMLSelectElement>(null),
    autoDemo: useRef<HTMLElement>(null),
  };
  const domRef = useRef(dom);
  const api = useRef<ReturnType<typeof createPhysicsController> | null>(null);
  if (api.current === null)
    api.current = createPhysicsController(s, render, live, domRef.current);
  const c = api.current;

  // Mirrors the original controller's set(): visibility, language and
  // provider status arrive from the shell; a language change discards a
  // pending manual reply and pauses a scripted run.
  // Declared before the prop effect so a StrictMode remount revives the
  // store before set() runs again.
  useEffect(() => {
    s.destroyed = false;
    return () => c.destroy();
  }, [c, s]);
  const previousLanguage = useRef(language);
  useEffect(() => {
    const before = previousLanguage.current;
    previousLanguage.current = language;
    c.applyProps(before);
  }, [visible, language, status, c]);
  useEffect(() => {
    const onVisibility = () => c.onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [c]);

  const view: View = { s, c, lang: language, status, post, onLanguage };
  const copy = t(language),
    zh = language === "zh",
    manual = s.experienceMode === "manual",
    active = c.autoActive(),
    motion = c.motionMode(),
    flight = c.flightMode(),
    suction = c.suctionMode(),
    scripted = Boolean(
      status.traceEnabled || s.demoPresetUsed || s.session?.demoUsed,
    ),
    presentation = demoPresentation(s.autoStage, language, c.suctionDemoMode());
  const journey = (
    <JourneyView
      register={c.registerJourney}
      plotFocus={s.guidedDemo ? String(presentation.journeyFocus) : ""}
    />
  );
  const suctionLab = <SuctionLabView register={c.registerSuction} />;
  const demoAnimation =
    s.animationHost === "journey"
      ? journey
      : s.animationHost === "suction"
        ? suctionLab
        : null;
  const traceConsole = (
    <ProviderConsole
      post={post}
      language={language}
      enabled={status.traceEnabled && visible}
      sessionId={s.session?.sessionId ?? null}
      busy={s.polling}
      refreshKey={s.traceRefresh}
      followLatest={active && s.consoleOpen}
      open={s.consoleOpen}
      onToggle={c.toggleConsole}
      className="lab-console"
    />
  );
  return (
    <div
      className={`lab-root${manual ? " experience-manual" : " experience-demo"}${suction ? " suction-active" : ""}`}
      hidden={!visible}
    >
      <p id="connection" className="fine">
        {s.ready
          ? `${s.session?.llm?.label ?? c.selectedTarget()?.label ?? ""} · ${copy.ready}`
          : copy.unavailable}
      </p>
      <div id="physics-area">
        <nav className="experience-modes" aria-label="Experience">
          <button
            type="button"
            id="mode-demo"
            aria-pressed={!manual}
            disabled={s.busy}
            onClick={() => c.chooseExperience("demo")}
          >
            {zh ? "观看演示" : "Watch a demo"}
          </button>
          <button
            type="button"
            id="mode-manual"
            className="example"
            aria-pressed={manual}
            disabled={s.busy}
            onClick={() => c.chooseExperience("manual")}
          >
            {zh ? "检验我的说法" : "Test my claim"}
          </button>
        </nav>
        <details id="model-settings" className="quiet-details">
          <summary id="model-settings-label">
            {zh ? "模型设置" : "Model settings"}
          </summary>
          <p id="demo-mode-note" className="demo-mode-note" hidden={!scripted}>
            {status.traceEnabled
              ? zh
                ? "开发演示 · 请求追踪已启用，可能显示核验答案；结果不计为独立迁移。"
                : "Developer demo · provider tracing can expose checked answers; results do not count as independent transfer."
              : zh
                ? "脚本演示 · 使用了预设提示；结果不计为独立迁移。"
                : "Scripted demo · preset prompts used; results do not count as independent transfer."}
          </p>
          <section className="model-setup">
            <label htmlFor="llm-model" id="llm-model-label">
              {zh ? "提供商 / 模型" : "Provider / model"}
            </label>
            <select
              id="llm-model"
              value={s.modelId}
              disabled={Boolean(s.session) || s.busy || active}
              onChange={(e) => c.chooseModel(e.target.value)}
            >
              {status.models.map((target) => (
                <option
                  key={target.id}
                  value={target.id}
                  disabled={!target.configured}
                >
                  {target.label}
                </option>
              ))}
            </select>
            <p id="llm-model-note" className="fine">
              {zh
                ? "每个会话固定一个模型；重置后可切换。Ollama 串行运行，先卸载再换模型，首次加载可能较慢。"
                : "One model per session; reset to change. Ollama runs one request at a time and unloads before switching; a cold start can take longer."}
            </p>
          </section>
        </details>
        <section className="setup" aria-label="Session setup">
          <label className="topic-label">
            <span id="topic-label">{copy["topic-label"]}</span>
            <select
              id="topic"
              ref={dom.topic}
              value={s.topic}
              disabled={Boolean(s.session) || s.busy || active}
              onChange={(e) =>
                c.chooseTopic(e.target.value as (typeof topics)[number])
              }
            >
              {topics.map((id) => (
                <option key={id} value={id}>
                  {status.problems.find((p) => p.id === id)?.title[language] ??
                    topicLabels[id]}
                </option>
              ))}
            </select>
          </label>
          <p className="consent" id="consent-text">
            {copy["consent-text"]}
          </p>
          <button
            id="start"
            disabled={!s.ready || s.busy || Boolean(s.session) || active}
            onClick={() => void c.start()}
          >
            {copy.start}
          </button>
        </section>
        <GuidedDemo
          view={view}
          autoDemoRef={dom.autoDemo}
          animation={demoAnimation}
        />
        <MotionSettings view={view} />
        <p id="notice" role="status" aria-live="polite">
          {s.notice}
        </p>
        <details id="prototype-about" className="quiet-details">
          <summary id="prototype-about-label">
            {zh ? "关于此原型" : "About this prototype"}
          </summary>
          <p id="independence-note">
            {zh
              ? "独立开发的教学原型。图示经过简化，数值均为假设。外部名称仅用于标明资料来源与所用服务；本项目不声称获得相关方的赞助或背书。"
              : "Independently developed educational prototype. Diagrams are simplified illustrations and values are hypothetical. External names identify sources and services used; no sponsorship or endorsement is claimed."}
          </p>
          <p id="provenance" className="fine provenance">
            {provenanceText(language, { motion, flight, suction })}
          </p>
        </details>
        <details
          id="session-record"
          className="quiet-details"
          hidden={!s.session}
          open={s.sessionRecordOpen || (manual && Boolean(s.session))}
          onToggle={(e) => c.toggleSessionRecord(e.currentTarget.open)}
        >
          <summary id="session-record-label">
            {zh ? "会话记录与核验证据" : "Session record & checked evidence"}
          </summary>
          <Workspace
            view={view}
            dom={dom}
            journey={s.animationHost !== "journey" ? journey : null}
            suctionLab={s.animationHost !== "suction" ? suctionLab : null}
          />
        </details>
        {s.consoleHost === "area" && traceConsole}
        <section id="empty" className="empty" hidden={Boolean(s.session)}>
          <span aria-hidden="true">
            {suction
              ? "Δp × A → ?"
              : flight
                ? "θ(t) → ?"
                : motion
                  ? "v(t) → ?"
                  : "f(x) → ?"}
          </span>
          <p id="empty-text">{copy["empty-text"]}</p>
          <p className="fine" id="empty-note">
            {copy["empty-note"]}
          </p>
        </section>
      </div>
    </div>
  );
}
