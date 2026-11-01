import { useId } from "react";
import { say, type Language } from "../lib/types";

export function CreateWorkspaceHeader({
  language,
  title,
  area,
  status,
  saving,
  canSave,
  onArea,
  onHome,
  onNew,
  onSave,
  saved,
}: {
  language: Language;
  title: string;
  area: "create" | "tryout";
  status: string;
  saving: boolean;
  canSave: boolean;
  saved: boolean;
  onArea: (area: "create" | "tryout") => void;
  onHome: () => void;
  onNew: () => void;
  onSave: () => void;
}) {
  const id = useId();
  return (
    <header className="create-workspace-header">
      <div className="workspace-topline">
        <button className="text-button" onClick={onHome}>
          <span aria-hidden="true">←</span>{" "}
          {say(language, "Create home", "创作首页")}
        </button>
        <span className="fine" role="status">
          {status}
        </span>
      </div>
      <div className="workspace-title-row">
        <h1>{title}</h1>
        <div className="actions">
          <button className="secondary" onClick={onNew}>
            {say(language, "New lesson", "新建课程")}
          </button>
          <button disabled={!canSave || saving} onClick={onSave}>
            {saving
              ? say(language, "Saving…", "正在保存…")
              : saved
                ? say(language, "Save changes", "保存修改")
                : say(language, "Save lesson", "保存课程")}
          </button>
        </div>
      </div>
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label={say(language, "Lesson workspace", "课程工作区")}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "create"
              : event.key === "End"
                ? "tryout"
                : area === "create"
                  ? "tryout"
                  : "create";
          onArea(next);
          event.currentTarget
            .querySelector<HTMLButtonElement>(`[data-area="${next}"]`)
            ?.focus();
        }}
      >
        {(["create", "tryout"] as const).map((value) => (
          <button
            key={value}
            id={`${id}-${value}`}
            type="button"
            role="tab"
            data-area={value}
            aria-selected={area === value}
            aria-controls={`workspace-${value}-panel`}
            tabIndex={area === value ? 0 : -1}
            onClick={() => onArea(value)}
          >
            {value === "create"
              ? say(language, "Create", "创作")
              : say(language, "Tryout", "试学")}
          </button>
        ))}
      </div>
    </header>
  );
}
