import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Drawing } from "../lib/types";

export function PredictionLayer({
  drawing,
  onChange,
}: {
  drawing: Drawing | null;
  onChange?: (drawing: Drawing) => void;
}) {
  const stroke = useRef<{ pointer: number; points: Drawing["points"] } | null>(
    null,
  );
  const [live, setLive] = useState<Drawing | null>(null);
  function point(event: PointerEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement!,
      matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(matrix.inverse());
    return {
      x: Math.max(0, Math.min(1, (local.x - 64) / 548)),
      y: Math.max(0, Math.min(1, (224 - local.y) / 188)),
    };
  }
  function append(event: PointerEvent<SVGRectElement>) {
    const current = stroke.current,
      p = point(event);
    if (!current || current.pointer !== event.pointerId || !p) return;
    // Decimate a long gesture while retaining its beginning and latest end.
    if (current.points.length >= 128)
      current.points = current.points.filter((_, i) => i % 2 === 0);
    current.points.push(p);
    setLive({ points: [...current.points] });
  }
  const points = (live ?? drawing)?.points;
  return (
    <g className="prediction-layer">
      {points && (
        <path
          className="prediction-path"
          d={points
            .map(
              (p, i) => `${i ? "L" : "M"} ${64 + p.x * 548} ${224 - p.y * 188}`,
            )
            .join(" ")}
          fill="none"
          stroke="var(--series-1, #ad582d)"
          strokeWidth={3}
          strokeDasharray="7 5"
          pointerEvents="none"
        />
      )}
      {onChange && (
        <rect
          x={64}
          y={36}
          width={548}
          height={188}
          fill="transparent"
          className="prediction-input"
          onPointerDown={(event) => {
            if (event.button !== 0 || stroke.current) return;
            event.preventDefault();
            const p = point(event);
            if (!p) return;
            stroke.current = { pointer: event.pointerId, points: [p] };
            setLive({ points: [p] });
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={append}
          onPointerUp={(event) => {
            if (stroke.current?.pointer !== event.pointerId) return;
            append(event);
            const complete = stroke.current;
            stroke.current = null;
            setLive(null);
            if (complete.points.length >= 2)
              onChange({ points: complete.points });
          }}
          onPointerCancel={() => {
            stroke.current = null;
            setLive(null);
          }}
          onLostPointerCapture={() => {
            stroke.current = null;
            setLive(null);
          }}
        />
      )}
    </g>
  );
}
