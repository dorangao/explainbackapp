import { useState } from "react";
import type { Drawing, Experiment, Language } from "../lib/types";
import { say } from "../lib/types";
import { chartDomain } from "../../public/lesson-canvas.mjs";
import { ExperimentView } from "./ExperimentView";
import "../canvas.css";

export function PredictionCanvas({
  experiment,
  language,
  drawing,
  onChange,
  preview,
  progress,
  busy = false,
}: {
  experiment: Experiment;
  language: Language;
  drawing: Drawing | null;
  onChange: (drawing: Drawing | null) => void;
  preview: boolean;
  progress: number;
  busy?: boolean;
}) {
  const { low, high } = chartDomain(experiment);
  const [values, setValues] = useState(["", "", ""]);
  const valid = values.every(
    (v) =>
      v.trim() !== "" &&
      Number.isFinite(Number(v)) &&
      Number(v) >= low &&
      Number(v) <= high,
  );
  return (
    <section
      className="prediction-canvas"
      aria-label={say(language, "Prediction canvas", "预测画布")}
    >
      <div className="canvas-heading">
        <h3>
          {say(
            language,
            preview
              ? "Sketch your prediction"
              : "Your prediction meets the model",
            preview ? "画出你的预测" : "对比预测与模型",
          )}
        </h3>
        <span className="canvas-step">{preview ? "03" : "04"}</span>
      </div>
      <p className="fine">
        {say(
          language,
          preview
            ? "Draw the curve you expect, or enter three points below. Then choose agree, disagree, or not sure to test the claim."
            : "Dashed line: your prediction. Solid line: the model calculation. Explain what agrees or differs.",
          preview
            ? "画出你预期的曲线，或在下方输入三个点。然后选择同意、不同意或不确定，检验这个说法。"
            : "虚线是你的预测，实线是模型计算。请解释两者的相同或不同之处。",
        )}
      </p>
      <ExperimentView
        experiment={experiment}
        language={language}
        preview={preview}
        progress={progress}
        interactive={false}
        onScrub={() => {}}
        drawing={drawing}
        onDrawing={preview && !busy ? onChange : undefined}
      />
      <p className="fine">
        {say(
          language,
          `Graph uses authored units: ${experiment.unit}. A sketch is a prediction, not a measurement.`,
          `图表使用原始单位：${experiment.unit}。草图是预测，并非测量数据。`,
        )}
      </p>
      {preview && (
        <>
          <details className="prediction-points">
            <summary>
              {say(
                language,
                "Enter three points with the keyboard",
                "用键盘输入三个点",
              )}
            </summary>
            <div className="prediction-point-fields">
              {[
                say(language, "Start prediction", "起点预测"),
                say(language, "Middle prediction", "中点预测"),
                say(language, "End prediction", "终点预测"),
              ].map((label, i) => (
                <label key={i}>
                  {label} ({experiment.unit})
                  <input
                    aria-label={label}
                    type="number"
                    min={low}
                    max={high}
                    step="any"
                    value={values[i]}
                    disabled={busy}
                    onChange={(event) =>
                      setValues(
                        values.map((v, j) =>
                          i === j ? event.target.value : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="secondary"
              disabled={busy || !valid}
              onClick={() => {
                if (valid)
                  onChange({
                    points: values.map((v, i) => ({
                      x: i / 2,
                      y: (Number(v) - low) / (high - low),
                    })),
                  });
              }}
            >
              {say(language, "Use these points", "使用这些点")}
            </button>
          </details>
          {drawing && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => onChange(null)}
            >
              {say(language, "Clear prediction drawing", "清除预测草图")}
            </button>
          )}
        </>
      )}
    </section>
  );
}
