import type { Experiment, Language } from "../lib/types";
import { t } from "../lib/messages";
import { formatDemoNumber as fmt } from "../lib/shared";
const colors = ["#116d60", "#ad582d", "#655598", "#456a99"];
export function ExperimentView({
  experiment: e,
  progress: u,
  language,
  interactive,
  onScrub,
}: {
  experiment: Experiment;
  progress: number;
  language: Language;
  interactive: boolean;
  onScrub: (value: number) => void;
}) {
  if (e.kind === "process")
    return (
      <div className="process-flow">
        {e.processStages?.map((step, i) => (
          <button
            key={i}
            type="button"
            className="process-step"
            aria-current={Math.round(u * e.steps) === i ? "step" : undefined}
            disabled={!interactive}
            onClick={() => onScrub(i / e.steps)}
          >
            <span className="process-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
          </button>
        ))}
      </div>
    );
  const points = Array.from({ length: e.steps + 1 }, (_, i) =>
    e.sample(i / e.steps),
  );
  const min = Math.min(0, ...points.flat()),
    max = Math.max(0, ...points.flat()),
    spread = max === min ? 1 : max - min,
    low = min < 0 ? min - spread * 0.04 : 0,
    high = max + spread * 0.08;
  const X = (v: number) => 64 + v * 548,
    Y = (v: number) => 224 - ((v - low) / (high - low)) * 188,
    values = e.sample(u);
  return (
    <div className="experiment-drawing">
      <svg
        viewBox="0 0 640 270"
        role="img"
        aria-label={`${e.title} · ${e.unit}`}
      >
        {Array.from({ length: 5 }, (_, i) => {
          const value = low + (i * (high - low)) / 4,
            y = Y(value);
          return (
            <g key={i}>
              <line x1={64} x2={612} y1={y} y2={y} stroke="#dce3dc" />
              <text
                x={56}
                y={y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#5d6c67"
              >
                {fmt(value)}
              </text>
            </g>
          );
        })}
        {e.series.map((_, j) => (
          <g key={j}>
            <path
              d={points
                .map((p, i) => `${i ? "L" : "M"} ${X(i / e.steps)} ${Y(p[j])}`)
                .join(" ")}
              stroke={colors[j]}
              fill="none"
              strokeWidth={2.8}
              strokeDasharray={j % 2 ? "6 4" : undefined}
            />
            <circle cx={X(u)} cy={Y(values[j])} r={5} fill={colors[j]} />
          </g>
        ))}
        <line
          x1={X(u)}
          x2={X(u)}
          y1={30}
          y2={225}
          stroke="#71867c"
          strokeDasharray="3 4"
        />
        <text x={64} y={18} fontSize={12} fill="#354a42">
          {e.unit}
        </text>
        <text x={64} y={245} fontSize={11} fill="#5d6c67">
          {e.gates?.[0] ?? e.axisEnds?.[0] ?? 0}
        </text>
        <text x={612} y={245} textAnchor="end" fontSize={11} fill="#5d6c67">
          {e.gates?.at(-1) ?? e.axisEnds?.[1] ?? 1}
        </text>
      </svg>
      <p className="chart-axis">{e.axis}</p>
      <div className="chart-legend">
        {e.series.map((label, i) => (
          <span key={label}>
            <span className={`series-swatch series-${i}`} />
            {label}: <strong>{fmt(values[i])}</strong> {e.unit}
          </span>
        ))}
      </div>
      {e.reference && u === 1 && (
        <p className="fine">
          {t(language, "ExperimentView.classical0011MixtureIn")}
          {e.reference
            .map((p, i) => `${e.series[i]} ${p.toFixed(0)}%`)
            .join(" · ")}
        </p>
      )}
      {e.position && (
        <svg
          viewBox="0 0 640 70"
          role="img"
          aria-label={t(language, "ExperimentView.distanceFromTheStart")}
        >
          {e.position(u).map((x, i) => (
            <g key={i}>
              <line
                x1={64}
                x2={612}
                y1={20 + i * 32}
                y2={20 + i * 32}
                stroke="#ccd7cd"
              />
              <rect
                x={64 + x * 520}
                y={10 + i * 32}
                width={24}
                height={12}
                rx={3}
                fill={colors[i]}
              />
            </g>
          ))}
        </svg>
      )}
      {e.rotation && (
        <svg
          viewBox="0 0 640 100"
          role="img"
          aria-label={t(
            language,
            "ExperimentView.controlledSidewaysRollSchematicFront",
          )}
        >
          <g
            transform={`translate(320 50) rotate(${(e.rotation(u).angle * 180) / Math.PI})`}
          >
            <rect
              x={-42}
              y={-10}
              width={84}
              height={20}
              rx={7}
              fill={colors[0]}
            />
            <rect x={-30} y={10} width={13} height={10} fill="#243b35" />
            <rect x={17} y={10} width={13} height={10} fill="#243b35" />
          </g>
        </svg>
      )}
    </div>
  );
}
