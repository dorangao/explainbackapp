import { useState } from "react";
import { t } from "../lib/messages";
import type { Language, Post } from "../lib/types";
import { deleteLesson, editHash, notifySharedChanged } from "../lib/library";

// Edit and Delete for a shared lesson its own creator is looking at, on the lesson's
// page and on its library card. Edit opens the saved copy on the Create page
// (#edit:<id>), so a save updates the same link; Delete asks twice and removes the
// lesson and its link for everyone.
export function OwnerActions({
  language,
  id,
  post,
  busy = false,
  onDeleted,
  onNotice,
}: {
  language: Language;
  id: string;
  post: Post;
  busy?: boolean;
  onDeleted?: (id: string) => void;
  onNotice?: (text: string) => void;
}) {
  const [confirming, setConfirming] = useState(false),
    [deleting, setDeleting] = useState(false);
  async function remove() {
    setDeleting(true);
    try {
      await deleteLesson(post, id);
      notifySharedChanged();
      onNotice?.(t(language, "Library.deleted"));
      onDeleted?.(id);
    } catch {
      onNotice?.(t(language, "Library.deleteFailed"));
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }
  return (
    <p
      className="owner-actions fine"
      role="group"
      aria-label={t(language, "Library.yourLesson")}
    >
      <span>{t(language, "Library.yourLessonNote")}</span>
      <a className="text-button" href={editHash(id)}>
        {t(language, "Library.editThisLesson")}
      </a>
      {confirming ? (
        <span className="shelf-confirm">
          <button
            type="button"
            className="text-button danger"
            disabled={deleting}
            onClick={() => void remove()}
          >
            {t(language, "Library.yesDelete")}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={deleting}
            onClick={() => setConfirming(false)}
          >
            {t(language, "Library.keep")}
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="text-button"
          disabled={busy || deleting}
          onClick={() => setConfirming(true)}
        >
          {t(language, "Library.delete")}
        </button>
      )}
    </p>
  );
}
