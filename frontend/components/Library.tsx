import { useCallback, useEffect, useState } from "react";
import { t } from "../lib/messages";
import type { Language, Post } from "../lib/types";
import { ApiError } from "../lib/api";
import {
  canSystemShare,
  copyText,
  deleteLesson,
  listMine,
  readMine,
  shareLesson,
  sharedUrl,
  systemShare,
} from "../lib/library";
import type { SavedLesson, SavedSummary } from "../lib/library";
export const kindLabel = (language: Language, kind: SavedSummary["kind"]) =>
  t(
    language,
    kind === "process"
      ? "Gallery.processExplorer"
      : kind === "catalog"
        ? "Gallery.experimentSeries"
        : "Gallery.adjustableModel",
  );
export const whenLabel = (language: Language, at: number) =>
  new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(at);
// Share controls for one saved lesson: a link that works signed out, copy and the
// system share sheet. Sharing is a flag on the saved copy, never a model request.
export function ShareControls({
  language,
  post,
  item,
  busy,
  onChange,
  onNotice,
}: {
  language: Language;
  post: Post;
  item: SavedSummary;
  busy: boolean;
  onChange: (next: SavedSummary) => void;
  onNotice: (text: string) => void;
}) {
  const [working, setWorking] = useState(false);
  const url = sharedUrl(item.id);
  const toggle = async () => {
    setWorking(true);
    try {
      onChange(await shareLesson(post, item.id, !item.shared));
      onNotice(
        t(
          language,
          item.shared ? "Library.linkTurnedOff" : "Library.linkTurnedOn",
        ),
      );
    } catch (e) {
      onNotice(
        e instanceof ApiError
          ? e.message
          : t(language, "Library.couldNotUpdate"),
      );
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="share-controls">
      <button
        type="button"
        className={item.shared ? "share-toggle on" : "share-toggle"}
        role="switch"
        aria-checked={item.shared}
        disabled={busy || working}
        onClick={() => void toggle()}
      >
        <span className="share-knob" aria-hidden="true" />
        {t(language, item.shared ? "Library.sharedByLink" : "Library.private")}
      </button>
      {item.shared && (
        <>
          <input
            className="share-url"
            readOnly
            value={url}
            aria-label={t(language, "Library.shareLink")}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="text-button"
            onClick={() =>
              void copyText(url).then((ok) =>
                onNotice(
                  t(language, ok ? "Library.linkCopied" : "Library.copyFailed"),
                ),
              )
            }
          >
            {t(language, "Library.copyLink")}
          </button>
          {canSystemShare() && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                void systemShare({
                  title: item.title[language],
                  text: item.intro[language],
                  url,
                })
              }
            >
              {t(language, "Library.shareDots")}
            </button>
          )}
        </>
      )}
    </div>
  );
}
// The creator's shelf: every lesson this sign-in saved, newest first.
export function LessonShelf({
  language,
  post,
  currentId,
  busy,
  onOpen,
  onNotice,
  onDeleted,
}: {
  language: Language;
  post: Post;
  currentId: string | null;
  busy: boolean;
  onOpen: (record: SavedLesson) => void;
  onNotice: (text: string) => void;
  onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<SavedSummary[] | null>(null),
    [limit, setLimit] = useState(50),
    [failed, setFailed] = useState(false),
    [confirming, setConfirming] = useState<string | null>(null),
    [opening, setOpening] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await listMine();
      setItems(result.lessons);
      setLimit(result.limit);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const update = (next: SavedSummary) =>
    setItems((list) =>
      (list ?? []).map((item) => (item.id === next.id ? next : item)),
    );
  const open = async (item: SavedSummary) => {
    setOpening(item.id);
    try {
      onOpen(await readMine(item.id));
    } catch {
      onNotice(t(language, "Library.couldNotOpen"));
    } finally {
      setOpening(null);
    }
  };
  const remove = async (item: SavedSummary) => {
    try {
      await deleteLesson(post, item.id);
      setItems((list) => (list ?? []).filter((x) => x.id !== item.id));
      setConfirming(null);
      onDeleted(item.id);
      onNotice(t(language, "Library.deleted"));
    } catch {
      onNotice(t(language, "Library.couldNotUpdate"));
    }
  };
  return (
    <section className="lesson-shelf" aria-labelledby="lesson-shelf-heading">
      <div className="section-title">
        <div>
          <p className="eyebrow">{t(language, "Library.yourLessons")}</p>
          <h2 id="lesson-shelf-heading">
            {t(language, "Library.pickUpWhereYouLeft")}
          </h2>
        </div>
        {items && (
          <span className="quiet-label">
            {items.length} / {limit}
          </span>
        )}
      </div>
      {failed ? (
        <p className="notice">
          {t(language, "Library.couldNotLoad")}{" "}
          <button className="text-button" onClick={() => void load()}>
            {t(language, "Library.retry")}
          </button>
        </p>
      ) : items === null ? (
        <p role="status">{t(language, "Studio.loading")}</p>
      ) : items.length === 0 ? (
        <p className="shelf-empty">{t(language, "Library.nothingSavedYet")}</p>
      ) : (
        <ul className="shelf-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={
                item.id === currentId ? "shelf-item current" : "shelf-item"
              }
            >
              {item.cover && (
                <img
                  className="shelf-thumb"
                  src={item.cover}
                  alt=""
                  width={120}
                  height={80}
                  loading="lazy"
                />
              )}
              <div className="shelf-main">
                <span className="lesson-kind">
                  {kindLabel(language, item.kind)}
                  {item.reviewedAt && (
                    <span className="shelf-flag">
                      {t(language, "Library.reviewedFlag")}
                    </span>
                  )}
                  {item.hasShow && (
                    <span className="shelf-flag">
                      {t(language, "Library.withShow")}
                    </span>
                  )}
                  {item.hasTryout && (
                    <span className="shelf-flag">
                      {t(language, "Library.tried")}
                    </span>
                  )}
                  {item.graded > 0 && (
                    <span className="shelf-flag">
                      {item.graded} {t(language, "Library.graded")}
                    </span>
                  )}
                  {item.id === currentId && (
                    <span className="shelf-flag current">
                      {t(language, "Library.open")}
                    </span>
                  )}
                </span>
                <h3>{item.title[language]}</h3>
                <p className="fine">
                  {t(language, "Library.updated")}{" "}
                  {whenLabel(language, item.updatedAt)}
                  {item.model && ` · ${item.model}`}
                </p>
                <ShareControls
                  language={language}
                  post={post}
                  item={item}
                  busy={busy}
                  onChange={update}
                  onNotice={onNotice}
                />
              </div>
              <div className="shelf-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || opening === item.id}
                  onClick={() => void open(item)}
                >
                  {t(language, "Library.openLesson")}
                </button>
                {confirming === item.id ? (
                  <span className="shelf-confirm">
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => void remove(item)}
                    >
                      {t(language, "Library.yesDelete")}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setConfirming(null)}
                    >
                      {t(language, "Library.keep")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => setConfirming(item.id)}
                  >
                    {t(language, "Library.delete")}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
