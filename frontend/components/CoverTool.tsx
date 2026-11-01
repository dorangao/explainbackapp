import { useId, useState } from "react";
import { t } from "../lib/messages";
import type { CoverReply, Language } from "../lib/types";
import { applyCover, useCovers } from "../lib/covers";
import { galleryShow, lessonCover } from "../lib/shared";

// On a reviewed lesson's page, a signed-in creator can have Muse Image draw the library
// cover (one image request). The new cover is served to every visitor from then on; the
// lesson itself is untouched. Covers are decorative and never reviewed.
export function CoverTool({
  language,
  lessonId,
  busy,
  onDraw,
}: {
  language: Language;
  lessonId: string;
  busy: boolean;
  onDraw: () => Promise<CoverReply | null>;
}) {
  const headingId = useId();
  const override = useCovers()[lessonId] ?? null;
  // Studio keys this tool by lesson id, so a new lesson starts with fresh state.
  const [drawn, setDrawn] = useState<CoverReply | null>(null);
  const shipped =
    lessonCover(lessonId)?.src ?? galleryShow(lessonId)?.cover ?? null;
  const current = drawn?.cover ?? override?.src ?? shipped;
  const stamp = drawn
    ? `${drawn.model} · ${drawn.createdAt}`
    : override
      ? `${override.model} · ${override.createdAt}`
      : shipped
        ? t(language, "Cover.shipped")
        : null;
  return (
    <section className="cover-tool" aria-labelledby={headingId}>
      <div className="cover-tool-art">
        {current ? (
          <img src={current} alt="" width={240} height={160} />
        ) : (
          <div className="cover-tool-empty">{t(language, "Cover.none")}</div>
        )}
      </div>
      <div className="cover-tool-body">
        <p className="eyebrow">{t(language, "Cover.eyebrow")}</p>
        <h3 id={headingId}>{t(language, "Cover.title")}</h3>
        <p className="fine">
          {stamp
            ? `${t(language, "Cover.currentCover")} ${stamp}. `
            : `${t(language, "Cover.noCoverYet")} `}
          {t(language, "Cover.note")}
        </p>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() =>
            void onDraw().then((reply) => {
              if (!reply) return;
              setDrawn(reply);
              applyCover(reply.lessonId, {
                src: reply.cover,
                model: reply.model,
                createdAt: reply.createdAt,
                promptVersion: reply.promptVersion,
              });
            })
          }
        >
          {busy
            ? t(language, "Cover.drawing")
            : t(language, current ? "Cover.redraw" : "Cover.draw")}
        </button>
        {drawn && (
          <p className="fine" role="status">
            {t(language, "Cover.drawnNote")}
          </p>
        )}
      </div>
    </section>
  );
}
