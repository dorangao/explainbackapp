// Local types for the lab components. The learning engines in public/*.mjs
// stay untyped JavaScript; these shapes describe only what the views read.
import type { Language, Post, Status } from "../../lib/types";
export type { Language, Post, Status, Target } from "../../lib/types";
export type LabProps = {
  language: Language;
  visible: boolean;
  status: Status;
  post: Post;
  onBusy: (busy: boolean) => void;
  onLanguage: (language: Language) => void;
};
export type RequestError = Error & {
  status?: number;
  attemptsRemaining?: number;
};
export type Bilingual = { en: string; zh: string };
export type Problem = {
  id: string;
  title: string;
  expression: string;
  prompt: string;
  purpose?: string;
  formula?: string;
};
export type HistoryEntry = {
  explanation: string;
  action: string;
  reason: string;
  feedback: string;
  question: string;
  assessment: "ambiguous" | "misconception" | "supported";
  evidence: string;
  model?: string;
  observation?: { x: number; y: number };
};
export type Claim = {
  id: string;
  quote: string;
  interpretation: string;
  scope: string;
  experimentId: string;
  confirmed?: boolean;
  confirmationSource?: string;
};
export type EvidenceRecord = {
  id: string;
  experimentId: string;
  formulaId: string;
  conclusion: Bilingual;
  proof: Bilingual;
  limitations: Bilingual;
};
export type AnswerField = { key: string; label: Bilingual };
export type Report = {
  outcome: "insufficient" | "independent" | "assisted";
  checkedAnswer?: Record<string, number>;
  reasoningAssessment?: unknown;
  revision?: string;
  evidenceIds?: string[];
  limitation?: Bilingual;
};
// Graph payloads are consumed by the drawing modules; only the fields the
// controller itself reads are typed here.
export type Graph = {
  formula?: unknown;
  expression?: string;
  leftLimit?: string | number;
  rightLimit?: string | number;
  isReference?: boolean;
  scenario?: any;
  focus?: string;
};
export type Session = {
  sessionId: string;
  phase: string;
  workflow?: string;
  problem: Problem;
  history: HistoryEntry[];
  graph?: Graph | null;
  attemptsRemaining: number;
  llm?: { label?: string; model?: string; timeoutMs?: number };
  probe?: string;
  observation?: { expression: string; x: number; y: number } | null;
  before?: string;
  after?: string;
  comparison?: { scaffolded?: boolean } | null;
  claim?: Claim | null;
  claimEvents?: { action: string; source?: string; interpretation: string }[];
  evidenceRecords?: EvidenceRecord[];
  report?: Report;
  answerFields?: AnswerField[];
  assumptions?: string;
  demoUsed?: boolean;
  designProposal?: unknown;
};
export type DemoPreset = {
  label: string;
  text: string;
  answer?: Record<string, number | string>;
};
