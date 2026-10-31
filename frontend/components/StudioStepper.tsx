import { t } from "../lib/messages";
import type { MessageKey } from "../lib/messages";
import type { Language } from "../lib/types";

// The five steps of creating a lesson, in the same strip the lesson player uses for
// Predict, Experiment, Explain and Transfer, so creators and learners read progress the
// same way. Each step names its cost before it is run; a finished step says Done.
export type StudioStep = "ask" | "review" | "try" | "show" | "save";
const steps: { id: StudioStep; label: MessageKey; cost: MessageKey }[] = [
  { id: "ask", label: "Studio.stepAsk", cost: "Studio.costOne" },
  { id: "review", label: "Studio.stepReview", cost: "Studio.costNone" },
  { id: "try", label: "Studio.stepTry", cost: "Studio.costOne" },
  { id: "show", label: "Studio.stepShow", cost: "Studio.costShow" },
  { id: "save", label: "Studio.stepSave", cost: "Studio.costNone" },
];
export function StudioStepper({
  language,
  current,
  done,
}: {
  language: Language;
  current: StudioStep;
  done: Partial<Record<StudioStep, boolean>>;
}) {
  return (
    <ol
      className="studio-stepper"
      aria-label={t(language, "Studio.creationSteps")}
    >
      {steps.map((step, index) => (
        <li
          key={step.id}
          aria-current={step.id === current ? "step" : undefined}
          className={done[step.id] ? "is-complete" : undefined}
        >
          <span className="step-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <strong>{t(language, step.label)}</strong>
          <small>
            {done[step.id]
              ? t(language, "Studio.stepDone")
              : t(language, step.cost)}
          </small>
        </li>
      ))}
    </ol>
  );
}
