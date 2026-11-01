import { useId, useState } from "react";
import { t } from "../lib/messages";
import type { CoverReply, Language } from "../lib/types";
import { applyCover, useCovers } from "../lib/covers";
import { galleryShow, lessonCover } from "../lib/shared";

// A signed-in creator can have Muse Image draw a library cover (one image request): for
// a reviewed lesson from its page, where the cover becomes an override every visitor's
// library reads; or for one of their own saved lessons from the Create page, where it
// goes on the saved record and its card. The lesson itself is untouched. Covers are
// decorative and never reviewed.
export function CoverTool({
  language,
  busy,
  onDraw,
  lessonId,
  saved = null,
}: {
  language: Language;
  busy: boolean;
  onDraw: () => Promise<CoverReply | null>;
  // A reviewed lesson's id, or...
  lessonId?: string;
  // ...the creator's own saved lesson.
  saved?: { cover: string | null; coverModel: string | null } | null;
}) {
  const headingId = useId();
  const overrides = useCovers();
  const override = lessonId ? (overrides[lessonId] ?? null) : null;
  // Studio keys this tool by lesson, so a new lesson starts with fresh state.
  const [drawn, setDrawn] = useState<CoverReply | null>(null);
  const shipped = lessonId
    ? (lessonCover(lessonId)?.src ?? galleryShow(lessonId)?.cover ?? null)
    : (saved?.cover ?? null);
  const current = drawn?.cover ?? override?.src ?? shipped;
  const stamp = drawn
    ? `${drawn.model} · ${drawn.createdAt}`
    : override
      ? `${override.model} · ${override.createdAt}`
      : shipped
        ? saved
          ? (saved.coverModel ?? t(language, "Cover.fromTheShow"))
          : t(language, "Cover.shipped")
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
          {t(language, saved ? "Cover.noteSaved" : "Cover.note")}
        </p>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() =>
            void onDraw().then((reply) => {
              if (!reply) return;
              setDrawn(reply);
              if (reply.lessonId)
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
            {t(language, saved ? "Cover.drawnNoteSaved" : "Cover.drawnNote")}
          </p>
        )}
      </div>
    </section>
  );
}
