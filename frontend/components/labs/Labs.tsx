import { say } from "../../lib/types";
import { t } from "../../lib/messages";
import { PhysicsLab } from "./PhysicsLab";
import { QuantumLab } from "./QuantumLab";
import type { LabProps } from "./types";
import { PageHeader } from "../PageHeader";
import "../../labs.css";
// The experiment bench: both labs are React now; the validated simulation and
// drawing modules in public/*.mjs stay unchanged behind thin wrappers.
export function Labs({
  kind,
  ...props
}: LabProps & { kind: "physics" | "quantum" }) {
  const { language, visible } = props;
  return (
    <section className="lab-workspace" hidden={!visible}>
      <PageHeader
        language={language}
        crumbs={[
          { label: t(language, "App.library"), href: "#studio" },
          {
            label: say(
              language,
              kind === "physics" ? "Physics & math" : "Quantum computing",
              kind === "physics" ? "物理与数学" : "量子计算",
            ),
          },
        ]}
        eyebrow={t(language, "Labs.theExperimentBench")}
        title={say(
          language,
          kind === "physics" ? "Physics & math" : "Quantum computing",
          kind === "physics" ? "物理与数学" : "量子计算",
        )}
        meta={t(language, "Labs.coachedMeta")}
      />
      {kind === "physics" ? (
        <PhysicsLab {...props} />
      ) : (
        <QuantumLab {...props} />
      )}
    </section>
  );
}
