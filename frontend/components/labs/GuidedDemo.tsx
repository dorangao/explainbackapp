import type { ReactNode, RefObject } from "react";
import { demoPresentation } from "../../../public/presentation.mjs";
import {
  suctionGuide,
  suctionGuideStages,
} from "../../../public/suction-demo.mjs";
import { demoGuide, guideStages } from "../../../public/demo-guide.mjs";
import { ProviderConsole } from "../ProviderConsole";
import type { View } from "./view";

export function GuidedDemo({
  view,
  autoDemoRef,
  animation,
}: {
  view: View;
  autoDemoRef: RefObject<HTMLElement | null>;
  animation: ReactNode;
}) {
  const { s, c, lang, status, post, onLanguage } = view;
  const zh = lang === "zh",
    suction = c.suctionDemoMode(),
    active = c.autoActive(),
    stages: string[] = suction ? suctionGuideStages : guideStages,
    maxCalls = suction ? 5 : 4,
    guide = (suction ? suctionGuide : demoGuide)(s.autoStage, lang) as
      string[] | null,
    presentation = demoPresentation(s.autoStage, lang, suction),
    manual = s.experienceMode === "manual";
  const states: Record<string, string> = zh
    ? {
        idle: suction
          ? "倒挂测试能证明所有角度都能抓附吗？"
          : "看起来平滑的特技，受力一定小吗？",
        running: s.autoWaiting
          ? "已暂停 · 阅读后点击下一步"
          : "进行中 · 请等待本步完成",
        complete:
          "演示完成 · 数值与推理已核验；计为辅助完成。可以再演示一次，或在下方继续用自己的解释。",
        stopped: "演示已停止；已发送的请求可能仍会完成。",
        attention: "演示已停在当前步骤，请查看反馈；可手动继续。",
      }
    : {
        idle: suction
          ? "Can a ceiling test prove grip at every angle?"
          : "Does a smooth-looking stunt mean low forces?",
        running: s.autoWaiting
          ? "Paused · read, then select Next"
          : "In progress · wait for this step to finish",
        complete:
          "Demo complete · values and reasoning checked; assisted result. Run it again, or continue with your own explanation below.",
        stopped: "Demo stopped; an already sent request may still finish.",
        attention:
          "Demo stopped at this step. Inspect feedback; you can continue manually.",
      };
  const statusText =
    states[s.autoState] +
    (s.autoState !== "idle"
      ? ` · ${s.autoCalls}/${maxCalls} ${zh ? "次提交尝试" : "submission attempts"}`
      : "") +
    (s.autoStopReason === "language"
      ? zh
        ? " 点击开始，以新语言重新演示。"
        : " Select Start to run in the new language."
      : "");
  const note = !status.traceEnabled
    ? zh
      ? "演示需启用 EXPLAINBACK_TRACE=1 并重启，以显示真实调用。"
      : "Enable EXPLAINBACK_TRACE=1 and restart to show live calls in the guided demo."
    : zh
      ? `辅助例解 · 每步暂停 · 最多 ${maxCalls} 次模型调用。切换语言会停止脚本并保留当前画面；重新开始可切换模型回复语言。`
      : `Worked example · pauses at each step · up to ${maxCalls} model calls. Changing language stops the script and preserves the scene; restart for provider replies in the new language.`;
  const finished = s.autoState === "complete" && !active;
  const nextText = finished
    ? zh
      ? "已完成 · 再演示一次 ↻"
      : "Finished · Run again ↻"
    : s.autoState === "complete"
      ? zh
        ? "已完成"
        : "Finished"
      : `${zh ? "下一步" : "Next"} → ${guide?.[4] ?? ""}`;
  const inTransfer = ["transfer", "complete"].includes(s.session?.phase ?? "");
  const reference = suction
    ? zh
      ? "假想静力模型 · 未经真实测试 · 迁移题另用机器人参数"
      : "Hypothetical static model · untested · transfer uses separate robot inputs"
    : !s.autoEvidence
      ? zh
        ? "起点预览 · 先预测，再显示图像。"
        : "Starting scene · graphs appear after the prediction."
      : inTransfer
        ? zh
          ? "初始示例参考 · 下方动画仍是 2000 kg、1.5 秒横滚，不是当前迁移题的参数。"
          : "Primary reference · the animation still uses 2000 kg and a 1.5 s roll, not the fresh transfer values."
        : zh
          ? "初始演示 · 同一光标贯穿地面加速、动力起飞、横滚与动力着陆；每段结束后暂停。"
          : "Primary demonstration · one cursor across ground acceleration, powered lift, roll and powered landing; each segment ends with a pause.";
  const guideLabels = zh
    ? ["说法 / 想法", "怎么看图", "结果 / 下一步"]
    : ["Claim / idea", "Read the graph", "Result / next action"];
  return (
    <section
      id="auto-demo"
      ref={autoDemoRef}
      className={`auto-demo${s.guidedDemo ? " guided-demo" : ""}${active ? " guide-active" : ""}${s.consoleOpen ? " trace-expanded" : ""}`}
      aria-labelledby="auto-demo-title"
      hidden={manual}
    >
      <div className="section-heading">
        <h2 id="auto-demo-title">
          {suction
            ? zh
              ? "吸附与设计 · 分步演示"
              : "Suction & design · guided demo"
            : zh
              ? "汽车物理 · 分步演示"
              : "Vehicle physics · guided demo"}
        </h2>
        <div className="journey-buttons">
          <label className="demo-language">
            <span id="auto-demo-kind-label">
              {zh ? "演示主题" : "Demo topic"}
            </span>
            <select
              id="auto-demo-kind"
              value={s.demoKind}
              disabled={active || s.busy}
              onChange={(e) =>
                c.chooseDemoKind(e.target.value as "vehicle" | "suction")
              }
            >
              <option value="vehicle">
                {zh ? "加速 · 横滚 · 着陆" : "Acceleration · roll · landing"}
              </option>
              <option value="suction">
                {zh ? "吸附 · 设计比较" : "Suction · design comparison"}
              </option>
            </select>
          </label>
          <label className="demo-language">
            English / 中文
            <select
              id="auto-demo-language"
              aria-label="Demo language / 演示语言"
              value={lang}
              onChange={(e) => onLanguage(e.target.value as "en" | "zh")}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
          <button
            type="button"
            id="auto-demo-run"
            disabled={!s.ready || !status.traceEnabled || s.busy || active}
            onClick={() => void c.runDemo()}
          >
            {zh ? "开始演示" : "Start demo"}
          </button>
          <button
            type="button"
            id="auto-demo-stop"
            className="example"
            hidden={!active}
            onClick={c.stopDemo}
          >
            {zh ? "停止演示" : "Stop demo"}
          </button>
        </div>
      </div>
      <p id="auto-demo-note" className="fine">
        {note}
      </p>
      <p id="auto-demo-progress" className="demo-progress">
        {s.guidedDemo && stages.includes(s.autoStage)
          ? zh
            ? `第 ${stages.indexOf(s.autoStage) + 1} / ${stages.length} 步`
            : `Step ${stages.indexOf(s.autoStage) + 1} of ${stages.length}`
          : ""}
      </p>
      <p id="auto-demo-status" role="status" aria-live="polite">
        {statusText}
      </p>
      <ol
        id="auto-demo-steps"
        className="auto-demo-steps"
        hidden={s.autoState === "idle"}
      >
        {presentation.labels.map((label: string, i: number) => (
          <li
            key={label}
            className={
              s.autoState === "complete" || i < presentation.current
                ? "done"
                : undefined
            }
            aria-current={i === presentation.current ? "step" : undefined}
          >
            {`${i + 1}. ${label}`}
          </li>
        ))}
      </ol>
      <div className="auto-demo-dashboard">
        <div className="auto-demo-main">
          <section
            id="auto-demo-guide"
            className="demo-guide"
            hidden={!s.guidedDemo || !guide}
            aria-labelledby="auto-demo-guide-title"
          >
            <div className="guide-heading">
              <h3 id="auto-demo-guide-title" tabIndex={-1}>
                {guide?.[0] ?? ""}
              </h3>
              <button
                type="button"
                id="auto-demo-next"
                disabled={
                  finished ? s.busy : !s.autoWaiting || !active || s.busy
                }
                onClick={(event) => c.demoNext(event.detail)}
                onKeyDown={(event) => {
                  if (
                    event.repeat &&
                    (event.key === "Enter" || event.key === " ")
                  )
                    event.preventDefault();
                }}
              >
                {nextText}
              </button>
            </div>
            <div className="guide-notes">
              <div className="guide-main-idea">
                <h4 id="guide-claim-label">{guideLabels[0]}</h4>
                <p id="guide-claim">{guide?.[1] ?? ""}</p>
              </div>
              <details className="guide-more">
                <summary id="guide-more-label">
                  {zh ? "解读图像与结果" : "Read the graph & result"}
                </summary>
                <div>
                  <h4 id="guide-graph-label">{guideLabels[1]}</h4>
                  <p id="guide-graph">{guide?.[2] ?? ""}</p>
                </div>
                <div>
                  <h4 id="guide-result-label">{guideLabels[2]}</h4>
                  <p id="guide-result">{guide?.[3] ?? ""}</p>
                </div>
              </details>
            </div>
          </section>
          <p id="auto-demo-feedback" role="status">
            {s.autoDemoFeedback}
          </p>
          <p
            id="auto-demo-reference"
            className="demo-reference"
            hidden={!s.guidedDemo}
          >
            {reference}
          </p>
          <button
            type="button"
            id="demo-continue"
            className="example"
            hidden={!s.guidedDemo || active || !s.session}
            onClick={() => c.chooseExperience("manual")}
          >
            {zh ? "用自己的解释继续" : "Continue with my own explanation"}
          </button>
          <div id="auto-demo-animation">{animation}</div>
          <details id="auto-demo-preview" hidden={!s.autoDemoPreview}>
            <summary id="auto-demo-preview-title">
              {zh
                ? "本步预设与真实反馈"
                : "This step’s preset and live feedback"}
            </summary>
            <blockquote id="auto-demo-prompt">{s.autoDemoPrompt}</blockquote>
          </details>
        </div>
        <div id="auto-demo-console">
          {s.consoleHost === "auto" && (
            <ProviderConsole
              post={post}
              language={lang}
              enabled={status.traceEnabled && s.workspaceVisible}
              sessionId={s.session?.sessionId ?? null}
              busy={s.polling}
              refreshKey={s.traceRefresh}
              followLatest={active && s.consoleOpen}
              open={s.consoleOpen}
              onToggle={c.toggleConsole}
              className="lab-console"
            />
          )}
        </div>
      </div>
    </section>
  );
}
