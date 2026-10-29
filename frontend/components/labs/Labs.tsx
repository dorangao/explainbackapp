import { say } from "../../lib/types";
import { t } from "../../lib/messages";
import { PhysicsLab } from "./PhysicsLab";
import { QuantumLab } from "./QuantumLab";
import type { LabProps } from "./types";
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
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">{t(language, "Labs.theExperimentBench")}</p>
          <h1>
            {say(
              language,
              kind === "physics" ? "Physics & math" : "Quantum computing",
              kind === "physics" ? "物理与数学" : "量子计算",
            )}
          </h1>
        </div>
        <a className="back-link" href="#studio">
          {t(language, "Labs.exploreLessons")} ↗
        </a>
      </div>
      {kind === "physics" ? (
        <PhysicsLab {...props} />
      ) : (
        <QuantumLab {...props} />
      )}
    </section>
  );
}
