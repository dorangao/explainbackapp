import type { Language, Session } from "./types";
// Copy tables from the original physics controller, kept verbatim.
export const copy = {
  en: {
    "vehicle-acceleration": "1 · Acceleration & force",
    "vehicle-flight": "2 · Sideways roll & landing",
    "vehicle-stage-note": "Changing stage resets the current session.",
    "flight-settings-heading":
      "Choose a hypothetical sideways roll and landing",
    "flight-mass-label": "Total mass (kg)",
    "flight-time-label": "Airborne time T (s)",
    "flight-radius-label": "Roll radius of gyration k (m), I=mk²",
    "flight-separation-label": "Pure-couple force separation d (m)",
    "flight-stop-label": "Vertical stopping time D (s)",
    "flight-profile-label": "Net upward acceleration during contact",
    "flight-setting-note":
      "k describes mass distribution about the front-to-back roll axis. Values are hypothetical and fixed per session. A starts spinning; B assumes an opposed air-jet couple. Jet performance is unmodeled. Contact is separate.",
    "flight-metric-label": "Graph view",
    "example-torque": "Torque & spin",
    "example-landing": "Landing force",
    "motion-mass-label": "Total mass, including occupants (kg)",
    "motion-grip-label": "Effective tire grip μ (unitless)",
    "motion-power-label": "Available wheel power (kW)",
    "example-force": "Mass & force",
    "example-smooth": "Smoothness",
    "motion-settings-heading": "Choose a hypothetical experiment",
    "motion-speed-label": "Final speed (both cars)",
    "motion-duration-label": "Time from rest (both cars)",
    "motion-profile-label": "Car B’s acceleration",
    "motion-setting-note":
      "A has constant acceleration. Every setting is hypothetical, not a manufacturer specification. Settings stay fixed for a session; reset to change them.",
    "motion-assumptions-heading": "What this model assumes",
    "motion-metric-label": "Graph view",
    provenance:
      "Baseline: bilingual adaptive coach and fixed math. Extension: claim confirmation, checked evidence, replay, and transfer report. Implementation starts October 26 Pacific; competition eligibility unresolved.",
    "claim-heading": "Is this your claim?",
    "confirm-claim": "Yes, test this claim",
    "revise-claim": "Revise my meaning",
    "confirm-note": "Confirmation runs locally. No model request.",
    "evidence-heading": "Checked evidence",
    "evidence-note":
      "Code checks the fixed mathematical identity. Claim interpretation and reasoning assessments come from the selected model and may be wrong.",
    "values-legend": "Your transfer values",
    "asymptote-label": "Horizontal asymptote y =",
    "crossing-label": "Crossing input x =",
    "values-note":
      "Enter both values with your reasoning, or leave both blank to ask for help.",
    "report-heading": "Transfer evidence",
    headline: "Make your reasoning visible.",
    subtitle:
      "Explain in your own words. Find one gap. Try the idea somewhere new.",
    eyebrow: "LEARNING LAB · TESTER PREVIEW",
    "topic-label": "Explore an idea",
    "consent-text":
      "Use synthetic examples. No real student or private information.",
    start: "Start a session ↗",
    reset: "Reset session",
    "explanation-label": "Explain why, not just the answer.",
    "example-label": "Synthetic starting points:",
    "example-ambiguous": "A vague claim",
    "example-misconception": "A possible misconception",
    submit: "Get one next step →",
    "request-note":
      "One live model request per submission. No automatic retries.",
    "graph-heading": "Look at the behavior.",
    "graph-tag": "VERIFIED MATH",
    "scrubber-label": "Explore a finite input",
    "margin-note":
      "A limit describes what happens toward an end. A value tells you what happens at one input.",
    "comparison-label": "YOUR REASONING, SIDE BY SIDE",
    "before-label": "Where you started",
    "after-label": "On a fresh problem",
    "learning-note":
      "Your explanation supports this transfer problem. One response is evidence to build on, not a claim of lasting mastery.",
    again: "Explore another idea →",
    "trail-label": "Reasoning trail",
    "empty-text": "Choose one idea and bring a synthetic explanation.",
    "empty-note":
      "English or Chinese. A small question, a visible change in thinking.",
    "footer-left":
      "Independent learning prototype · Synthetic examples · Temporary sessions",
    "footer-right": "Model feedback + deterministic graphs",
    steps: ["01 · Explain", "02 · Reflect", "03 · Transfer", "04 · Compare"],
    stages: {
      explain: "YOUR REASONING",
      revisit: "REVISIT ONE IDEA",
      transfer: "A FRESH PROBLEM",
      complete: "A CHANGE IN REASONING",
    },
    actions: {
      ask_clarification: "Clarify the meaning",
      ask_prediction: "Predict before checking",
      evaluate_point: "Check one value",
      reveal_graph: "Test the idea with a graph",
      select_transfer: "Try a targeted transfer",
      compare_reasoning: "Compare the reasoning",
    },
    labels: {
      ambiguous: "LET’S CLARIFY",
      misconception: "ONE POSSIBLE GAP",
      supported: "REASONING SUPPORTED",
    },
    pending: "Reading your reasoning…",
    unavailable: "Selected provider needs configuration",
    ready: "Configured · live requests",
    graphHidden:
      "Make a prediction first. We can reveal the graph when it helps test your idea.",
    placeholder: "I think… because…",
    newSession: "Session reset. Choose an idea and start again.",
  },
  zh: {
    "vehicle-acceleration": "1 · 加速度与力",
    "vehicle-flight": "2 · 侧向翻滚与着陆",
    "vehicle-stage-note": "切换阶段将重置当前会话。",
    "flight-settings-heading": "选择一个假想横滚与着陆实验",
    "flight-mass-label": "总质量 (kg)",
    "flight-time-label": "空中时间 T (s)",
    "flight-radius-label": "横滚回转半径 k (m)，I=mk²",
    "flight-separation-label": "力偶两力作用线间距 d (m)",
    "flight-stop-label": "竖直制停时间 D (s)",
    "flight-profile-label": "接触期间净向上加速度",
    "flight-setting-note":
      "k 描述绕车身前后纵轴的质量分布。数值为假设，每次会话固定。A 起飞时已旋转；B 假设有相反空气推力偶。喷流性能未建模，接触阶段单独计算。",
    "flight-metric-label": "图像视图",
    "example-torque": "力矩与旋转",
    "example-landing": "着陆力",
    "motion-mass-label": "总质量，含乘员 (kg)",
    "motion-grip-label": "有效轮胎抓地系数 μ（无量纲）",
    "motion-power-label": "可用轮端功率 (kW)",
    "example-force": "质量与力",
    "example-smooth": "平滑度",
    "motion-settings-heading": "选择一个假想实验",
    "motion-speed-label": "末速度（两车相同）",
    "motion-duration-label": "从静止开始的时间（两车相同）",
    "motion-profile-label": "B 车的加速度",
    "motion-setting-note":
      "A 车的加速度恒定。所有数值均为假设，并非厂商规格。每次会话设置固定；重置后可修改。",
    "motion-assumptions-heading": "模型假设",
    "motion-metric-label": "图像视图",
    provenance:
      "已有基础：双语自适应辅导与固定数学题库。新增：确认说法、核验证据、重放与迁移报告。实际开发始于太平洋时间10月26日；参赛资格尚待确认。",
    "claim-heading": "这是你想表达的说法吗？",
    "confirm-claim": "是，检验这个说法",
    "revise-claim": "修改我的意思",
    "confirm-note": "确认在本地完成，不发送模型请求。",
    "evidence-heading": "已核验的证据",
    "evidence-note":
      "代码核验固定数学恒等式。说法解读和推理评价来自所选模型，可能有误。",
    "values-legend": "你的迁移题数值",
    "asymptote-label": "水平渐近线 y =",
    "crossing-label": "穿越点的输入 x =",
    "values-note": "结合推理填写两个数值；如需帮助，可以将两个输入框都留空。",
    "report-heading": "迁移证据",
    headline: "让你的思考看得见。",
    subtitle: "用自己的话讲出来，找到一个缺口，再用一道新题检验。",
    eyebrow: "学习实验室 · 测试预览",
    "topic-label": "探索一个想法",
    "consent-text": "请使用虚构示例，不输入真实学生资料或私人信息。",
    start: "开始学习 ↗",
    reset: "重置本次学习",
    "explanation-label": "请解释为什么，而不只是给出答案。",
    "example-label": "虚构示例：",
    "example-ambiguous": "一个模糊的说法",
    "example-misconception": "一个可能的误解",
    submit: "获取一个下一步 →",
    "request-note": "每次提交发送一次真实模型请求，不会自动重试。",
    "graph-heading": "看看函数的行为。",
    "graph-tag": "已核验的数学",
    "scrubber-label": "探索一个有限的输入值",
    "margin-note": "极限描述趋向某一端时的行为；函数值描述某个输入处的结果。",
    "comparison-label": "对照你的两次推理",
    "before-label": "最初的想法",
    "after-label": "面对一道新题",
    "learning-note":
      "这次解释支持你在这道迁移题上的理解。一次回答只是进一步学习的依据，不代表已经长期掌握。",
    again: "探索另一个想法 →",
    "trail-label": "推理记录",
    "empty-text": "选择一个概念，从一段虚构的解释开始。",
    "empty-note": "中文或英文。一个小问题，一次看得见的思考变化。",
    "footer-left": "独立教学原型 · 虚构示例 · 临时会话",
    "footer-right": "模型反馈 + 确定性图像",
    steps: ["01 · 解释", "02 · 反思", "03 · 迁移", "04 · 对照"],
    stages: {
      explain: "讲出你的推理",
      revisit: "重新思考一个概念",
      transfer: "一道全新的题",
      complete: "推理的变化",
    },
    actions: {
      ask_clarification: "先澄清含义",
      ask_prediction: "先预测，再验证",
      evaluate_point: "核验一个函数值",
      reveal_graph: "用图像检验想法",
      select_transfer: "尝试针对性的迁移题",
      compare_reasoning: "对照两次推理",
    },
    labels: {
      ambiguous: "先澄清一下",
      misconception: "一个可能的理解缺口",
      supported: "推理得到支持",
    },
    pending: "正在阅读你的推理…",
    unavailable: "所选提供商尚未配置",
    ready: "已配置 · 真实模型调用",
    graphHidden: "先讲出预测。需要时再展开图像，检验你的想法。",
    placeholder: "我认为……因为……",
    newSession: "学习记录已重置。选择一个概念重新开始。",
  },
};
export type Copy = (typeof copy)["en"];
export const t = (language: Language): Copy => copy[language];
export const say = (language: Language, en: string, zh: string) =>
  language === "zh" ? zh : en;
export const topics = [
  "suction",
  "acceleration",
  "flight",
  "crossing",
  "nonzero",
  "ends",
] as const;
export type Topic = (typeof topics)[number];
export const topicLabels: Record<Topic, string> = {
  suction: "Suction & design lab",
  acceleration: "Acceleration & force lab",
  flight: "Sideways roll & landing lab",
  crossing: "Can an asymptote be crossed?",
  nonzero: "Does every fraction approach zero?",
  ends: "Do both ends behave the same?",
};
export const motionProfileOptions: [string, string, string][] = [
  ["rising", "Increasing", "递增"],
  ["falling", "Decreasing", "递减"],
  ["smooth", "Cosine pulse · smooth joins", "余弦脉冲 · 平滑衔接"],
];
export const motionMetricOptions: [string, string, string][] = [
  ["velocity", "Velocity (m/s)", "速度 (m/s)"],
  ["acceleration", "Acceleration (m/s²)", "加速度 (m/s²)"],
  ["distance", "Distance (m)", "路程 (m)"],
  ["force", "Required force (kN)", "所需力 (kN)"],
  ["powerKw", "Wheel power (kW)", "轮端功率 (kW)"],
  ["jerk", "Jerk (m/s³)", "加加速度 (m/s³)"],
];
export const flightProfileOptions: [string, string, string][] = [
  ["constant", "Constant", "恒定"],
  ["pulse", "Cosine pulse", "余弦脉冲"],
];
export const examples: Record<string, Record<Language, [string, string]>> = {
  flight: {
    en: [
      "The car flips and comes back upright, so I am unsure what is still moving.",
      "In this ideal model, returning to an upright angle after a full turn means both objects have zero angular speed at touchdown.",
    ],
    zh: [
      "车翻转后回正了，我不清楚此时还有什么在运动。",
      "在此理想模型中，转过一整圈回正就意味着两个物体接地时角速度都为零。",
    ],
  },
  acceleration: {
    en: [
      "The car accelerates really fast, so I am not sure what the number means.",
      "If two cars reach the same final speed in the same time, they must have identical acceleration at every instant and travel the same distance.",
    ],
    zh: [
      "车加速很快，但我不清楚这个数值说明了什么。",
      "如果两辆车在同样时间达到同样末速度，那么每一瞬间的加速度都相同，行驶的路程也一定相同。",
    ],
  },
  crossing: {
    en: [
      "It can never touch the asymptote.",
      "At every finite x, it is impossible for the curve to equal the asymptote because it is a barrier.",
    ],
    zh: [
      "曲线永远碰不到渐近线。",
      "任何有限的 x 都不能让曲线等于渐近线，因为渐近线就是一道边界。",
    ],
  },
  nonzero: {
    en: [
      "The denominator becomes very large, so maybe it goes down.",
      "The limit is zero because the denominator goes to infinity, regardless of the numerator.",
    ],
    zh: [
      "分母越来越大，所以它可能会变小。",
      "极限是零，因为分母趋向无穷大，不需要考虑分子的变化。",
    ],
  },
  ends: {
    en: [
      "Both ends should settle down.",
      "Both limits are 1 because the square root of x squared is always x.",
    ],
    zh: [
      "两端应该都会稳定下来。",
      "两个极限都是 1，因为 x 平方的平方根总是 x。",
    ],
  },
};
export const vehicleExamples: Record<
  "example-torque" | "example-landing" | "example-force" | "example-smooth",
  [string, string]
> = {
  "example-torque": [
    "In this model B starts and ends with zero spin, so the torque must be zero at every instant during its full turn.",
    "在本模型中，B 初末角速度都为零，所以完整翻转过程中每一瞬间的力矩都应为零。",
  ],
  "example-landing": [
    "In this vertical-only contact model, equal stopping impulse means the average force and peak force must be identical for every force shape.",
    "在此竖直接触模型中，相同制停冲量意味着任何力曲线的平均力和峰值力都相同。",
  ],
  "example-force": [
    "If a heavier car follows exactly the same speed curve, it needs no extra force or power.",
    "如果更重的车遵循完全相同的速度曲线，它不需要额外的力或功率。",
  ],
  "example-smooth": [
    "A sine/cosine speed curve guarantees a comfortable ride and makes the acceleration physically achievable.",
    "正弦/余弦速度曲线能保证乘坐舒适，也能保证加速在物理上可行。",
  ],
};
export function experimentName(id: string, language: Language) {
  const zh = language === "zh";
  const suctionNames: Record<string, [string, string]> = {
    "suction-static": ["Stationary pressure", "静止压差"],
    "suction-orientation": ["Orientation and grip", "角度与抓附"],
    "suction-leakage": ["Leakage and power", "泄漏与功率"],
    "suction-design": ["Constrained design comparison", "约束下的设计比较"],
  };
  if (suctionNames[id]) return suctionNames[id][zh ? 1 : 0];
  const flightNames: Record<string, string> = zh
    ? {
        "flight-torque": "力矩与角动量",
        "flight-contact": "接触冲量与峰值力",
        "flight-state": "接地姿态与剩余运动",
      }
    : {
        "flight-torque": "Torque and angular momentum",
        "flight-contact": "Contact impulse and peak force",
        "flight-state": "Touchdown orientation and residual motion",
      };
  if (flightNames[id]) return flightNames[id];
  if (id === "motion-force")
    return zh ? "质量、力与理想上限" : "Mass, force and ideal limits";
  if (id === "motion-smoothness")
    return zh ? "加加速度与平滑衔接" : "Jerk and smooth joins";
  if (id === "motion-acceleration")
    return zh
      ? "平均加速度与瞬时加速度"
      : "Average versus instantaneous acceleration";
  if (id === "motion-distance")
    return zh
      ? "端点速度与速度曲线下的面积"
      : "Endpoint speeds versus area under velocity";
  const names: Record<string, string> = zh
    ? {
        "finite-equality": "有限交点",
        "finite-crossing": "有限穿越与两端极限",
        "end-behavior": "两端的极限",
      }
    : {
        "finite-equality": "Finite intersection",
        "finite-crossing": "Finite crossing and end limits",
        "end-behavior": "End limits",
      };
  return names[id] || id;
}
export function claimScopeName(scope: string | undefined, language: Language) {
  const zh = language === "zh";
  return scope === "sealed-static-model"
    ? zh
      ? "密封表面静力模型"
      : "sealed static surface model"
    : scope === "ideal-flight-and-contact"
      ? zh
        ? "理想飞行与竖直接触"
        : "ideal flight and vertical contact"
      : scope === "prescribed-motion-interval"
        ? zh
          ? "设定的一维运动区间"
          : "prescribed 1D motion interval"
        : scope === "finite-inputs"
          ? zh
            ? "有限输入"
            : "finite inputs"
          : zh
            ? "无穷远处的行为"
            : "end behavior";
}
export function provenanceText(
  language: Language,
  mode: { motion: boolean; flight: boolean; suction: boolean },
) {
  // The original controller overwrote the provenance line in this order.
  const zh = language === "zh";
  let text: string = t(language).provenance;
  if (mode.motion)
    text = zh
      ? "已有基础：双语辅导、渐近线与加速度说法实验。此次新增：质量、力、抓地/功率上限、加加速度与余弦平滑曲线。实际开发日期已记录；参赛资格尚待确认。"
      : "Baseline: bilingual coach, crossing and acceleration claim labs. New extension: mass, force, grip/power limits, jerk and cosine profiles. Actual development dates are recorded; competition eligibility unresolved.";
  if (mode.flight)
    text = zh
      ? "已有基础：渐近线、加速度与力/体感实验。此次新增：理想翻转力矩、竖直接触力、交互播放与迁移题。实际开发日期已记录；参赛资格尚待确认。"
      : "Baseline: crossing, acceleration and force/feel labs. New stage: ideal flip torque, vertical contact forces, interactive playback and transfer. Actual development dates recorded; competition eligibility unresolved.";
  if (mode.suction)
    text = zh
      ? "已有基础：双语辅导、说法检验与 汽车加速/翻转/着陆实验。2026 年 10 月 27 日新增：静态吸附、泄漏/功率、设计比较与机器人迁移。不声称参赛资格。"
      : "Baseline: bilingual coach, claim workflow and vehicle acceleration/flip/landing labs. October 27, 2026 extension: static suction, leakage/power, design comparisons and robot transfer. No eligibility assertion.";
  if (mode.motion || mode.flight)
    text = zh
      ? "已有基础：加速、力与体感、翻转与着陆的独立实验。此次新增：连续演示、同步图像、预设提示和可选请求控制台。比赛资格尚待确认。"
      : "Baseline: separate acceleration, force/feel, flip and landing labs. New: continuous demo, synchronized graphs, presets and optional provider console. Event eligibility remains unresolved.";
  return text;
}
export function claimStageLabel(session: Session, language: Language): string {
  const zh = language === "zh",
    claimMode = session.workflow === "claim-testing",
    stages = t(language).stages as Record<string, string>;
  const claimStages: Record<string, string> = zh
    ? {
        claim: "讲出一个说法",
        confirm: "确认解读",
        prediction: "先预测",
        revision: "根据证据重新解释",
        "design-review": "解释设计比较",
        complete: "证据与迁移",
      }
    : {
        claim: "STATE A CLAIM",
        confirm: "CONFIRM THE INTERPRETATION",
        prediction: "PREDICT BEFORE CHECKING",
        revision: "RECONCILE THE EVIDENCE",
        "design-review": "EXPLAIN THE DESIGN COMPARISON",
        complete: claimMode ? "EVIDENCE AND TRANSFER" : stages.complete,
      };
  return (
    (claimMode ? claimStages[session.phase] : null) || stages[session.phase]
  );
}
