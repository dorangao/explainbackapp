export type Language = "en" | "zh";
export type Bilingual = Record<Language, string>;
export type Area = "studio" | "create" | "physics" | "quantum";
export type Target = {
  id: string;
  label: string;
  provider: string;
  model: string;
  configured: boolean;
  timeoutMs?: number;
};
export type Access = {
  label: string;
  remaining: number;
  quota: number;
  expiresAt: number;
};
export type AuthInfo = {
  configured: boolean;
  codes: boolean;
  open: boolean;
  authenticated: boolean;
};
export type Status = {
  configured: boolean;
  models: Target[];
  defaultModel: string;
  // Creator drafts and revises (Wonder when configured); tester tries a draft (Spark).
  roles?: { creator: string; tester: string };
  // Muse Voice Transcribe is available for the spoken explain-back.
  voice?: boolean;
  traceEnabled: boolean;
  access: Access | null;
  problems: { id: string; title: Bilingual }[];
};
export type Post = <T = unknown>(
  path: string,
  body: unknown,
  options?: { timeoutMs?: number; signal?: AbortSignal },
) => Promise<T>;
export type Input = {
  id: string;
  label: Bilingual;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
};
export type ModelDemo = {
  kind: "model";
  title: Bilingual;
  claim: Bilingual;
  assumptions: Bilingual;
  inputs: Input[];
  axis: { label: Bilingual; unit: string; min: number; max: number };
  outputs: { id: string; label: Bilingual; unit: string; expression: string }[];
  transfer: {
    question: Bilingual;
    values: { id: string; value: number }[];
    at: number;
    output: string;
  };
};
export type ProcessDemo = {
  kind: "process";
  title: Bilingual;
  claim: Bilingual;
  assumptions: Bilingual;
  stages: { title: Bilingual; detail: Bilingual }[];
  transfer: {
    question: Bilingual;
    choices: Bilingual[];
    answer: number;
    rationale: Bilingual;
  };
};
export type Demo = ModelDemo | ProcessDemo;
export type Chapter = {
  experiment: string;
  framing: Bilingual;
  explanation: Bilingual;
  demo?: Demo;
};
export type Lesson = {
  version: 1 | 2;
  title: Bilingual;
  intro: Bilingual;
  chapters: Chapter[];
};
export type GalleryItem = {
  id: string;
  kind: "model" | "process" | "catalog";
  source: string;
  image?: string;
  summary: Bilingual;
  lesson: Lesson;
};
export type Stage =
  "predict" | "experiment" | "explain" | "transfer" | "complete";
export type PlayerState = {
  chapter: number;
  stage: Stage;
  prediction: "agree" | "disagree" | "unsure" | null;
  variant: number;
  progress: number;
  transfer: boolean | null;
  controls: Record<string, number>;
  metric: number;
};
export type Experiment = {
  id: string;
  title: string;
  claim: string;
  assumptions: string;
  generated?: boolean;
  kind?: "model" | "process";
  steps: number;
  variants: string[];
  metrics: { label: string; value: number; unit: string }[];
  series: string[];
  unit: string;
  axis: string;
  axisEnds?: number[];
  gates?: string[];
  reference?: number[];
  inputs?: (Omit<Input, "label"> & { label: string })[];
  formulas?: { id: string; label: string; unit: string; expression: string }[];
  processStages?: { title: string; detail: string }[];
  sample: (progress: number) => number[];
  caption: (progress: number) => string;
  result: string;
  position?: (progress: number) => number[];
  rotation?: (progress: number) => { angle: number };
  quantumState?: unknown;
  basisLabels?: string[];
  transfer: {
    type?: string;
    question: string;
    choices?: string[];
    answer: number;
    unit: string;
    tolerance: number;
    hint?: string;
  };
};
export interface Player {
  lesson: Lesson;
  readonly state: PlayerState;
  experiment(language?: Language): Experiment;
  input(id: string, value: number): void;
  output(metric: number): void;
  predict(value: string): void;
  scrub(value: number): void;
  variant(value: number): void;
  check(raw: string): boolean | null;
  editAnswer(): void;
  next(): boolean;
  replay(): void;
  restart(): void;
}
export type Usage = { input: number | null; output: number | null };
export type ReplyMetrics = {
  model?: string;
  elapsedMs?: number;
  usage?: Usage | null;
};
export type Verdict = "supported" | "partly" | "unsupported";
export type Feedback = ReplyMetrics & {
  explanation: string;
  nextAction: "replay" | "compare" | "transfer";
  attemptsRemaining: number;
  // Present when the learner's own explanation was assessed.
  verdict?: Verdict;
  followUp?: string;
};
export type TryoutChapter = {
  prediction: "agree" | "disagree" | "unsure";
  reason: string;
  explanation: string;
  transfer: {
    given: string;
    correct: boolean;
    type: "number" | "choice";
    unit?: string;
    choice?: string | null;
  };
  confusions: string[];
  suggestions: string[];
};
export type TryoutReply = ReplyMetrics & {
  chapters: TryoutChapter[];
  overall: string;
  rating: number;
  llm: Target;
  attemptsRemaining: number;
};
export type ShowSlideKind =
  "cover" | "claim" | "experiment" | "evidence" | "transfer" | "takeaway";
export type ShowSlide = {
  kind: ShowSlideKind;
  chapter: number;
  heading: Bilingual;
  narration: Bilingual;
};
// A narrated slide script written by the creator model; the browser renders the slides
// from the checked lesson and speaks the narration.
export type Show = { version: 1; slides: ShowSlide[]; coverPrompt: string };
export type ShowReply = ReplyMetrics & {
  show: Show;
  cover: string | null;
  coverModel: string | null;
  llm: Target;
  attemptsRemaining: number;
};
export type GalleryShow = {
  show: Show;
  cover: string | null;
  model: string;
  coverModel: string | null;
  createdAt: string;
};
export type ComposeReply = ReplyMetrics & {
  status: "ready" | "unsupported";
  lesson: Lesson | null;
  message: Bilingual;
  attemptsRemaining: number;
};
export type StudioSession = { sessionId: string };
export const say = (lang: Language, en: string, zh: string) =>
  lang === "zh" ? zh : en;
