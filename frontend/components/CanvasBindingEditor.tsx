import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { CanvasBinding, Language, ModelDemo } from "../lib/types";
import { say } from "../lib/types";
import type { Detection } from "./Spotlight";
import { validateCanvas } from "../../public/lesson-canvas.mjs";
import "../canvas.css";

type Box = CanvasBinding["box"];
export function CanvasBindingEditor({
  image,
  demo,
  language,
  value,
  onChange,
  detection,
  onFind,
  busy = false,
}: {
  image: string;
  demo: ModelDemo;
  language: Language;
  value?: CanvasBinding;
  onChange: (value: CanvasBinding | undefined) => void;
  detection?: Detection | null;
  onFind?: (concept: string) => void;
  busy?: boolean;
}) {
  const [concept, setConcept] = useState(
    value?.concept ?? detection?.concept ?? "",
  );
  const [input, setInput] = useState(value?.input ?? demo.inputs[0].id);
  const [box, setBox] = useState<Box | null>(value?.box ?? null);
  const start = useRef<{
    x: number;
    y: number;
    pointer: number;
    previous: Box | null;
  } | null>(null);
  const position = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };
  const region = (event: PointerEvent<SVGSVGElement>): Box | null => {
    const a = start.current;
    if (!a || a.pointer !== event.pointerId) return null;
    const b = position(event);
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x),
      height: Math.abs(a.y - b.y),
    };
  };
  const changed =
    !value ||
    value.concept !== concept.trim() ||
    value.input !== input ||
    JSON.stringify(value.box) !== JSON.stringify(box);
  return (
    <section
      className="canvas-editor"
      aria-label={say(language, "Lesson canvas connection", "课程画布关联")}
    >
      <div className="canvas-heading">
        <div>
          <p className="eyebrow">
            {say(language, "Lesson canvas", "课程画布")}
          </p>
          <h3>
            {say(
              language,
              "Connect the picture to your experiment",
              "把图片与实验关联",
            )}
          </h3>
        </div>
        <span className="canvas-step">01 → 02</span>
      </div>
      <p>
        {say(
          language,
          "Select an object, choose the control it represents, then confirm. This connection is your teaching choice, not a measurement from the image.",
          "选择物体及其对应的控制参数，再确认关联。这是你的教学选择，并非从图片测得的数据。",
        )}
      </p>
      <div className="canvas-editor-grid">
        <div>
          <div className="canvas-image">
            <img
              src={image}
              alt={say(language, "Source sketch or photo", "原始草图或照片")}
            />
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-label={say(
                language,
                "Drag to select a region",
                "拖动选择区域",
              )}
              className="canvas-regions"
              data-editable={!busy}
              onPointerDown={(event) => {
                if (
                  busy ||
                  event.button !== 0 ||
                  (event.target as Element).closest('[role="button"]')
                )
                  return;
                event.preventDefault();
                start.current = {
                  ...position(event),
                  pointer: event.pointerId,
                  previous: box,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const next = region(event);
                if (next && !busy) setBox(next);
              }}
              onPointerUp={(event) => {
                const next = region(event);
                if (!next) return;
                setBox(
                  next.width > 0.01 && next.height > 0.01
                    ? next
                    : start.current!.previous,
                );
                start.current = null;
              }}
              onPointerCancel={() => {
                if (start.current) setBox(start.current.previous);
                start.current = null;
              }}
              onLostPointerCapture={() => {
                if (start.current) setBox(start.current.previous);
                start.current = null;
              }}
            >
              {detection &&
                detection.width > 0 &&
                detection.height > 0 &&
                detection.boxes.map((b, i) => {
                  const selected = {
                    x: Math.max(0, b.x1 / detection.width),
                    y: Math.max(0, b.y1 / detection.height),
                    width:
                      Math.min(detection.width, b.x2 + 1) / detection.width -
                      Math.max(0, b.x1 / detection.width),
                    height:
                      Math.min(detection.height, b.y2 + 1) / detection.height -
                      Math.max(0, b.y1 / detection.height),
                  };
                  if (selected.width <= 0 || selected.height <= 0) return null;
                  const choose = () => {
                    if (!busy) {
                      setBox(selected);
                      setConcept(detection.concept);
                    }
                  };
                  return (
                    <rect
                      key={i}
                      x={selected.x * 100}
                      y={selected.y * 100}
                      width={selected.width * 100}
                      height={selected.height * 100}
                      role="button"
                      tabIndex={busy ? -1 : 0}
                      aria-disabled={busy}
                      aria-label={say(
                        language,
                        `Select ${detection.concept} ${i + 1}`,
                        `选择${detection.concept} ${i + 1}`,
                      )}
                      onClick={choose}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          choose();
                        }
                      }}
                      className="canvas-suggestion"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              {box && (
                <rect
                  x={box.x * 100}
                  y={box.y * 100}
                  width={box.width * 100}
                  height={box.height * 100}
                  className="canvas-selection"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => setBox({ x: 0, y: 0, width: 1, height: 1 })}
          >
            {say(language, "Select whole image", "选择整张图片")}
          </button>
          <p className="fine">
            {say(
              language,
              "Drag a box, select a SAM suggestion, or use the whole image with the keyboard.",
              "拖动框选、选择 SAM 建议，或使用键盘选择整张图片。",
            )}
          </p>
        </div>
        <div className="canvas-connection-fields">
          <label>
            {say(language, "Object name", "物体名称")}
            <input
              value={concept}
              maxLength={60}
              disabled={busy}
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>
          {onFind && (
            <button
              type="button"
              className="secondary"
              disabled={busy || !concept.trim()}
              onClick={() => onFind(concept.trim())}
            >
              {say(language, "Find with SAM 3.1", "用 SAM 3.1 查找")}
            </button>
          )}
          {detection && (
            <p className="fine" role="status">
              {say(
                language,
                `SAM 3.1 suggested ${detection.boxes.length} regions. Select one or draw your own.`,
                `SAM 3.1 建议了 ${detection.boxes.length} 个区域。请选择一个或自行框选。`,
              )}
            </p>
          )}
          <label>
            {say(language, "Connect to control", "关联控制参数")}
            <select
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
            >
              {demo.inputs.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label[language]} · {i.unit}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !box ||
              box.width <= 0 ||
              box.height <= 0 ||
              !concept.trim() ||
              !changed
            }
            onClick={() => {
              if (box) onChange(validateCanvas({ concept, input, box }, demo));
            }}
          >
            {say(language, "Confirm connection", "确认关联")}
          </button>
          {value && (
            <>
              <p className="fine" role="status">
                {say(
                  language,
                  changed
                    ? "Your changes need confirmation."
                    : "Connection confirmed. Review the lesson before presenting.",
                  changed
                    ? "修改后请再次确认。"
                    : "关联已确认。演示前请审阅课程。",
                )}
              </p>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => onChange(undefined)}
              >
                {say(language, "Remove connection", "移除关联")}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
