import type { ReactNode } from "react";
import { flightMetrics } from "../../../public/flight-view.mjs";
import { t, say, motionMetricOptions, claimStageLabel } from "./physicsCopy";
import type { Dom } from "./physicsController";
import {
  ClaimConfirmation,
  EvidenceWorkbench,
  TransferReport,
} from "./ClaimWorkbench";
import type { View } from "./view";

function ReasoningPanel({ view, dom }: { view: View; dom: Dom }) {
  const { s, c, lang } = view;
  const copy = t(lang),
    zh = lang === "zh",
    session = s.session,
    phase = session?.phase ?? "",
    problem = session?.problem,
    claimMode = session?.workflow === "claim-testing",
    motion = c.motionMode(),
    flight = c.flightMode(),
    suction = c.suctionMode(),
    active = c.autoActive(),
    last = session?.history.at(-1),
    presets = c.presets();
  const examplesHidden =
    phase === "transfer" ||
    phase === "complete" ||
    phase === "confirm" ||
    (claimMode && phase !== "claim");
  const actions: Record<string, string> = zh
    ? {
        propose_design: "提出设计并运行核验比较",
        propose_claim: "提出待确认的解读",
        run_experiment: "执行已核验的实验",
      }
    : {
        propose_design: "Propose design and run checked comparison",
        propose_claim: "Propose an interpretation",
        run_experiment: "Execute the checked experiment",
      };
  const copyActions = copy.actions as Record<string, string>;
  const fields = session?.answerFields ?? [];
  const fieldLabel = (i: number, fallback: string) =>
    claimMode && fields[i] ? fields[i].label[lang] : fallback;
  const valuesNote = claimMode
    ? motion || flight
      ? zh
        ? "按上方单位填写两个数值并解释，可四舍五入到0.01。如需帮助可将两项留空。"
        : "Enter both values in the labeled units with reasoning, rounded to 0.01. Leave both blank to ask for help."
      : copy["values-note"]
    : copy["values-note"];
  const checked = session?.observation
    ? (() => {
        const point = session.observation!;
        const name = point.expression
          .split("=")[0]
          .trim()
          .replace("(x)", `(${point.x})`);
        return `${zh ? "已核验的数值" : "Checked value"} · ${name} = ${Number(point.y.toPrecision(8))}`;
      })()
    : "";
  const submitDisabled =
    s.busy ||
    s.sessionInterrupted ||
    !session ||
    ["complete", "confirm"].includes(phase) ||
    (session?.attemptsRemaining ?? 0) <= 0 ||
    active;
  const exampleDisabled = s.busy || active;
  return (
    <section className="reasoning" aria-labelledby="problem-title">
      <div className="section-heading">
        <p className="eyebrow" id="stage-label">
          {session ? claimStageLabel(session, lang) : copy.stages.explain}
        </p>
        <button className="text-button" id="reset" onClick={c.reset}>
          {copy.reset}
        </button>
      </div>
      <h2 id="problem-title">{problem?.title ?? ""}</h2>
      <details
        className="formula-details"
        open={Boolean(
          session && (phase === "transfer" || (!motion && !flight && !suction)),
        )}
      >
        <summary id="formula-details-label">
          {phase === "transfer"
            ? zh
              ? "本题参数"
              : "Problem inputs"
            : zh
              ? "模型与参数"
              : "Model & inputs"}
        </summary>
        <p className="expression" id="expression">
          {problem?.expression ?? ""}
        </p>
      </details>
      <p className="prompt" id="prompt">
        {session
          ? phase === "complete"
            ? problem!.prompt
            : session.probe || problem!.prompt
          : ""}
      </p>
      <form
        id="explain-form"
        hidden={phase === "complete" || phase === "confirm"}
        onSubmit={(event) => {
          event.preventDefault();
          void c.submit();
        }}
      >
        <div
          id="demo-presets"
          className="demo-presets"
          hidden={presets.length === 0}
        >
          <label htmlFor="demo-preset" id="demo-preset-label">
            {zh ? "演示预设 · 当前步骤" : "Demo preset · current step"}
          </label>
          <select
            id="demo-preset"
            value={presets[Number(s.demoPreset)] ? s.demoPreset : "0"}
            disabled={s.busy || active}
            onChange={(e) => c.choosePreset(e.target.value)}
          >
            {presets.map((preset, i) => (
              <option key={i} value={String(i)}>
                {preset.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            id="demo-load"
            className="example"
            disabled={s.busy || !session || active}
            onClick={c.loadPreset}
          >
            {zh ? "载入预设" : "Load preset"}
          </button>
          <p id="demo-preset-note" className="fine">
            {zh
              ? "可编辑，再点击提交。使用预设后，本会话标记为脚本演示，不作为独立迁移证据。"
              : "Load, optionally edit, then submit. Presets mark this session as a scripted demo, not independent transfer evidence."}
          </p>
        </div>
        <label htmlFor="explanation" id="explanation-label">
          {copy["explanation-label"]}
        </label>
        <textarea
          id="explanation"
          ref={dom.explanation}
          maxLength={1200}
          rows={5}
          required
          placeholder={copy.placeholder}
          value={s.explanation}
          disabled={s.busy || active}
          onChange={(e) => c.setExplanation(e.target.value)}
        />
        <div className="input-meta">
          <span id="character-count">{`${s.explanation.length} / 1200`}</span>
          <span id="attempts">
            {session
              ? zh
                ? `本次剩余 ${session.attemptsRemaining} 次请求`
                : `${session.attemptsRemaining} requests left in this session`
              : ""}
          </span>
        </div>
        <div className="example-row" hidden={examplesHidden}>
          <span id="example-label">{copy["example-label"]}</span>
          <button
            type="button"
            className="example"
            id="example-ambiguous"
            disabled={exampleDisabled}
            onClick={() => c.useExample(0)}
          >
            {copy["example-ambiguous"]}
          </button>
          <button
            type="button"
            className="example"
            id="example-misconception"
            disabled={exampleDisabled}
            onClick={() => c.useExample(1)}
          >
            {copy["example-misconception"]}
          </button>
          <button
            type="button"
            className="example"
            id="example-force"
            hidden={!motion}
            disabled={exampleDisabled}
            onClick={() => c.useVehicleExample("example-force")}
          >
            {copy["example-force"]}
          </button>
          <button
            type="button"
            className="example"
            id="example-smooth"
            hidden={!motion}
            disabled={exampleDisabled}
            onClick={() => c.useVehicleExample("example-smooth")}
          >
            {copy["example-smooth"]}
          </button>
          <button
            type="button"
            className="example"
            id="example-torque"
            hidden={!flight}
            disabled={exampleDisabled}
            onClick={() => c.useVehicleExample("example-torque")}
          >
            {copy["example-torque"]}
          </button>
          <button
            type="button"
            className="example"
            id="example-landing"
            hidden={!flight}
            disabled={exampleDisabled}
            onClick={() => c.useVehicleExample("example-landing")}
          >
            {copy["example-landing"]}
          </button>
        </div>
        <fieldset
          id="transfer-values"
          hidden={!(claimMode && phase === "transfer")}
        >
          <legend id="values-legend">{copy["values-legend"]}</legend>
          <label>
            <span id="asymptote-label">
              {fieldLabel(0, copy["asymptote-label"])}
            </span>
            <input
              id="transfer-asymptote"
              type="number"
              step="any"
              inputMode="decimal"
              value={s.transferA}
              disabled={s.busy || s.sessionInterrupted || active}
              onChange={(e) => c.setTransfer(0, e.target.value)}
            />
          </label>
          <label>
            <span id="crossing-label">
              {fieldLabel(1, copy["crossing-label"])}
            </span>
            <input
              id="transfer-crossing"
              type="number"
              step="any"
              inputMode="decimal"
              value={s.transferB}
              disabled={s.busy || s.sessionInterrupted || active}
              onChange={(e) => c.setTransfer(1, e.target.value)}
            />
          </label>
          <p id="values-note" className="fine">
            {valuesNote}
          </p>
        </fieldset>
        <button
          type="submit"
          id="submit"
          className={s.busy ? "busy" : undefined}
          disabled={submitDisabled}
        >
          {s.busy ? copy.pending : copy.submit}
        </button>
        <p id="request-note" className="fine">
          {copy["request-note"]}
        </p>
      </form>
      <ClaimConfirmation view={view} />
      <div id="error" className="error" role="alert" hidden={s.error === null}>
        {s.error ?? ""}
      </div>
      <section
        id="feedback"
        ref={dom.feedback}
        aria-live="polite"
        tabIndex={-1}
        hidden={!last}
      >
        <p className="eyebrow" id="feedback-label">
          {last ? copy.labels[last.assessment] : ""}
        </p>
        <p id="coach-action" className="coach-action">
          {last ? actions[last.action] || copyActions[last.action] || "" : ""}
        </p>
        <blockquote id="evidence">{last?.evidence ?? ""}</blockquote>
        <p id="feedback-text">{last?.feedback ?? ""}</p>
        <p id="coach-reason" className="coach-reason">
          {last
            ? `${zh ? "这一步的目的：" : "Why this step: "}${last.reason}`
            : ""}
        </p>
        <p
          id="checked-result"
          className="checked-result"
          hidden={!session?.observation}
        >
          {checked}
        </p>
        <p className="next-question" id="next-question">
          {last && phase !== "complete" ? session!.probe || last.question : ""}
        </p>
        <p className="fine" id="source">
          {last
            ? `${zh ? "真实模型反馈" : "Live model feedback"} · ${last.model || session?.llm?.model || "model"}`
            : ""}
        </p>
      </section>
    </section>
  );
}

function VisualPanel({
  view,
  dom,
  suctionLab,
}: {
  view: View;
  dom: Dom;
  suctionLab: ReactNode;
}) {
  const { s, c, lang } = view;
  const copy = t(lang),
    zh = lang === "zh",
    session = s.session,
    graph = session?.graph ?? null,
    motion = c.motionMode(),
    flight = c.flightMode(),
    suction = c.suctionMode(),
    scenario = graph?.scenario;
  const range =
    flight && graph
      ? { min: 0, max: scenario.airtime + scenario.stopTime, step: 0.0001 }
      : motion && graph
        ? { min: 0, max: scenario.T, step: scenario.T / 100 }
        : { min: -8, max: 8, step: 0.1 };
  let heading: string = copy["graph-heading"],
    tag: string = copy["graph-tag"],
    scrubberLabel: string = copy["scrubber-label"],
    marginNote: string = copy["margin-note"],
    legend = "",
    caption: string = graph
      ? `${graph.expression} · x → −∞: y → ${graph.leftLimit}; x → ∞: y → ${graph.rightLimit}${graph.isReference ? (zh ? "（上一题的参考图像）" : " (reference graph from the first problem)") : ""}`
      : copy.graphHidden;
  if (motion) {
    heading = zh
      ? "同样的端点，不同的运动。"
      : "Same endpoints, different motion.";
    tag = zh ? "假想解析模型" : "HYPOTHETICAL MODEL";
    scrubberLabel = zh ? "探索时间 t（秒）" : "Explore time t (seconds)";
    marginNote = zh
      ? "加速度是速度曲线的斜率；路程是速度曲线下的面积。"
      : "Acceleration is the slope of velocity; distance is the area under velocity.";
    if (graph)
      legend = zh
        ? `A：绿色实线，加速度恒定。B：棕色虚线，加速度${scenario.profileB === "rising" ? "递增" : scenario.profileB === "falling" ? "递减" : "为余弦脉冲"}。`
        : `A: green solid, constant acceleration. B: brown dashed, ${scenario.profileB === "rising" ? "increasing" : scenario.profileB === "falling" ? "decreasing" : "cosine-pulse"} acceleration.`;
    caption = graph
      ? zh
        ? `仅在 0 ≤ t ≤ ${scenario.T} s 区间内。两车从静止出发，末速度 ${scenario.speedLabel}。`
        : `Only on 0 ≤ t ≤ ${scenario.T} s. Both start from rest and finish at ${scenario.speedLabel}.`
      : zh
        ? "先给出预测，核验后再探索曲线。迁移题的图像需要额外帮助才会显示。"
        : "Make a prediction before exploring the curves. A transfer graph is available through additional help.";
  }
  if (flight) {
    heading = zh
      ? "回正以后，运动停止了吗？"
      : "Upright again. Has the motion stopped?";
    tag = zh ? "理想模型" : "IDEAL MODEL";
    scrubberLabel = zh
      ? "探索飞行与制停时间 t（秒）"
      : "Explore flight and stopping time t (seconds)";
    marginNote = zh
      ? "角度不等于角速度；接触力不等于合力；平均力不等于峰值力。"
      : "Angle is not angular speed. Contact force is not net force. Average is not peak.";
    legend = zh
      ? "旋转：A 绿色实线（已有旋转）；B 棕色虚线（外力偶控制）。竖直/接触：共享的一维计算。"
      : "Rotation: A green solid (initial spin); B brown dashed (external couple). Vertical/contact: one shared 1D calculation.";
    caption = graph
      ? zh
        ? `T=${scenario.airtime} s 接地，之后 D=${scenario.stopTime} s 仅计算竖直制停。旋转视图停在接地快照；不模拟 A 后续旋转或实车接触。`
        : `Touchdown at T=${scenario.airtime} s, then D=${scenario.stopTime} s of vertical-only stopping. Rotation view ends at a touchdown snapshot; A’s later spin and real contact are not simulated.`
      : zh
        ? "先预测，再显示模型。迁移题的图像需额外帮助或完成后才显示。"
        : "Predict before exploring. Transfer visuals require explicit help or completion.";
  }
  if (suction)
    caption = zh
      ? "固定证据与本地参数探索分开显示。"
      : "Pinned evidence and local exploration are shown separately.";
  const playing = s.playbackFrame !== null;
  return (
    <aside className="visual" aria-labelledby="graph-heading">
      {suctionLab}
      <div className="section-heading">
        <h2 id="graph-heading">{heading}</h2>
        <span className="small-label" id="graph-tag">
          {tag}
        </span>
      </div>
      <label
        id="motion-metric-wrap"
        className="motion-metric"
        hidden={!(motion && graph)}
      >
        <span id="motion-metric-label">{copy["motion-metric-label"]}</span>
        <select
          id="motion-metric"
          value={s.motionMetric}
          onChange={(e) => c.chooseMetric("motion", e.target.value)}
        >
          {motionMetricOptions.map(([value, en, zhText]) => (
            <option key={value} value={value}>
              {say(lang, en, zhText)}
            </option>
          ))}
        </select>
      </label>
      <label
        id="flight-metric-wrap"
        className="motion-metric"
        hidden={!(flight && graph)}
      >
        <span id="flight-metric-label">{copy["flight-metric-label"]}</span>
        <select
          id="flight-metric"
          value={s.flightMetric}
          onChange={(e) => c.chooseMetric("flight", e.target.value)}
        >
          {(flightMetrics as [string, string, string][]).map(
            ([value, en, zhText]) => (
              <option key={value} value={value}>
                {say(lang, en, zhText)}
              </option>
            ),
          )}
        </select>
      </label>
      <div
        id="flight-scene"
        className="flight-scene"
        ref={dom.flightScene}
        hidden
      />
      <p
        id="motion-legend"
        className="fine"
        hidden={!((motion || flight) && graph)}
      >
        {legend}
      </p>
      <div id="graph" className="graph" ref={dom.graph} />
      <p id="graph-caption" className="graph-caption">
        {caption}
      </p>
      <button
        type="button"
        id="flight-play"
        className="example"
        hidden={!(flight && graph)}
        aria-pressed={playing}
        disabled={s.busy || !graph || c.autoActive()}
        onClick={() => c.togglePlayback(range.max)}
      >
        {playing
          ? zh
            ? "暂停"
            : "Pause"
          : zh
            ? "播放时间线"
            : "Play timeline"}
      </button>
      <label className="scrubber" id="scrubber-wrap" hidden={!graph || suction}>
        <span id="scrubber-label">{scrubberLabel}</span>
        <input
          id="scrubber"
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={s.scrubber}
          onChange={(e) => c.scrub(Number(e.target.value))}
        />
        <output id="point-value" htmlFor="scrubber">
          {c.pointValue()}
        </output>
      </label>
      <div className="margin-note">
        <span aria-hidden="true">↳</span>
        <p id="margin-note">{marginNote}</p>
      </div>
      <section
        id="physics-panel"
        className="physics-panel"
        ref={dom.physicsPanel}
        hidden
        aria-label="Force and feel comparison"
      />
      <section
        id="flight-panel"
        className="physics-panel"
        ref={dom.flightPanel}
        hidden
        aria-label="Rotation and contact evidence"
      />
    </aside>
  );
}

export function Workspace({
  view,
  dom,
  journey,
  suctionLab,
}: {
  view: View;
  dom: Dom;
  journey: ReactNode;
  suctionLab: ReactNode;
}) {
  const { s, lang } = view;
  const copy = t(lang),
    zh = lang === "zh",
    session = s.session,
    phase = session?.phase ?? "",
    claimMode = session?.workflow === "claim-testing";
  const steps: string[] = claimMode
    ? zh
      ? ["01 · 说法", "02 · 证据", "03 · 迁移", "04 · 报告"]
      : ["01 · Claim", "02 · Evidence", "03 · Transfer", "04 · Report"]
    : copy.steps;
  const stage = !session
    ? 0
    : phase === "complete"
      ? 4
      : phase === "transfer"
        ? 3
        : ["revisit", "prediction", "revision", "design-review"].includes(phase)
          ? 2
          : 1;
  const learningNote = session?.comparison
    ? `${session.comparison.scaffolded ? (zh ? "这道迁移题使用了额外提示。" : "This transfer used additional scaffolding.") : ""} ${copy["learning-note"]}`
    : copy["learning-note"];
  return (
    <section id="workspace" hidden={!session}>
      {journey}
      <ol className="steps" aria-label="Learning progress">
        {steps.map((text, i) => (
          <li
            key={i}
            id={`step-${i + 1}`}
            className={i + 1 === stage ? "active" : undefined}
            aria-current={i + 1 === stage ? "step" : undefined}
          >
            {text}
          </li>
        ))}
      </ol>
      <div className="workspace-grid">
        <ReasoningPanel view={view} dom={dom} />
        <VisualPanel view={view} dom={dom} suctionLab={suctionLab} />
      </div>
      <EvidenceWorkbench view={view} />
      <section
        id="comparison"
        className="comparison"
        hidden={phase !== "complete"}
      >
        <p className="eyebrow" id="comparison-label">
          {copy["comparison-label"]}
        </p>
        <div>
          <article>
            <h3 id="before-label">{copy["before-label"]}</h3>
            <p id="before">{session?.before ?? ""}</p>
          </article>
          <article>
            <h3 id="after-label">{copy["after-label"]}</h3>
            <p id="after">{session?.after ?? ""}</p>
          </article>
        </div>
        <p id="learning-note">{learningNote}</p>
        <button id="again" onClick={view.c.again}>
          {copy.again}
        </button>
      </section>
      <TransferReport view={view} />
      <details id="trail">
        <summary id="trail-label">{copy["trail-label"]}</summary>
        <ol id="history">
          {(session?.history ?? []).map((entry, i) => (
            <li key={i}>
              {`${i + 1}. ${entry.explanation}\n${(copy.actions as Record<string, string>)[entry.action] || ""} · ${entry.reason}\n${entry.feedback}\n${entry.question}${entry.observation ? `\nx=${entry.observation.x} → y=${Number(entry.observation.y.toPrecision(8))}` : ""}`}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
