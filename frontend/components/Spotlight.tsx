import { useState } from "react";
import { t } from "../lib/messages";
import type { Language } from "../lib/types";
import { say } from "../lib/types";

export type Detection = {
  concept: string;
  boxes: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    confidence?: number;
  }[];
  width: number;
  height: number;
  model: string;
};
// The creator's sketch or photo with what SAM 3.1 found in it: a short noun phrase goes
// to the model, boxes come back in image pixels and are drawn over the image. One
// request per search; nothing is sent until the button is pressed.
export function Spotlight({
  language,
  image,
  detection,
  onFind,
  busy,
  canFind,
}: {
  language: Language;
  image: string;
  detection: Detection | null;
  // Absent when the segmentation model is unavailable or the viewer cannot request.
  onFind?: (concept: string) => void;
  busy?: boolean;
  canFind?: boolean;
}) {
  const [concept, setConcept] = useState(detection?.concept ?? "");
  const boxes = detection && detection.width > 0 ? detection.boxes : [];
  return (
    <div className="spotlight">
      <div className="spotlight-frame">
        <img src={image} alt="" />
        {detection && detection.width > 0 && boxes.length > 0 && (
          <svg
            className="spotlight-boxes"
            viewBox={`0 0 ${detection.width} ${detection.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {boxes.map((b, i) => (
              <rect
                key={i}
                x={b.x1}
                y={b.y1}
                width={Math.max(1, b.x2 - b.x1 + 1)}
                height={Math.max(1, b.y2 - b.y1 + 1)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}
      </div>
      {onFind && (
        <form
          className="spotlight-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (concept.trim()) onFind(concept.trim());
          }}
        >
          <input
            type="text"
            value={concept}
            maxLength={60}
            placeholder={t(language, "Spotlight.placeholder")}
            aria-label={t(language, "Spotlight.label")}
            onChange={(event) => setConcept(event.target.value)}
            disabled={busy}
          />
          <button
            type="submit"
            className="secondary"
            disabled={busy || canFind === false || !concept.trim()}
          >
            {busy
              ? t(language, "Spotlight.looking")
              : t(language, "Spotlight.find")}
          </button>
        </form>
      )}
      {detection && (
        <p className="fine spotlight-result" role="status">
          {boxes.length === 0
            ? say(
                language,
                `SAM 3.1 did not find “${detection.concept}” in this image.`,
                `SAM 3.1 没有在这张图片中找到“${detection.concept}”。`,
              )
            : say(
                language,
                `SAM 3.1 found ${boxes.length} × “${detection.concept}”; boxes drawn over the image.`,
                `SAM 3.1 找到 ${boxes.length} 处“${detection.concept}”，已在图片上框出。`,
              )}{" "}
          {t(language, "Spotlight.note")}
        </p>
      )}
    </div>
  );
}
