import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Language } from "../lib/types";
import type {
  AppearanceMode,
  AppearancePreference,
} from "../../public/appearance.js";
// oxlint-disable-next-line import/no-unassigned-import -- idempotent fallback for the synchronous head script
import "../../public/appearance.js";

const modes = [
  { id: "system", en: "System", zh: "跟随系统" },
  { id: "light", en: "Light", zh: "浅色" },
  { id: "dark", en: "Dark", zh: "深色" },
] as const;

function ModeIcon({ mode }: { mode: AppearanceMode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === "system" ? (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M9 21h6m-3-4v4" />
        </>
      ) : mode === "light" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      ) : (
        <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
      )}
    </svg>
  );
}

export function Appearance({ language }: { language: Language }) {
  const api = window.explainbackAppearance;
  const preference = useSyncExternalStore(api.subscribe, api.read);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const zh = language === "zh";
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const select = (next: AppearancePreference) => api.select(next);
  const schemeName = zh
    ? preference.scheme === "dark"
      ? "深色"
      : "浅色"
    : preference.scheme === "dark"
      ? "Dark"
      : "Light";
  return (
    <div
      className="appearance"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="appearance-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={`appearance-dot theme-${preference.theme}`}
          aria-hidden="true"
        />
        {zh ? "外观" : "Appearance"}
      </button>
      {open && (
        <section
          className="appearance-panel"
          id={id}
          aria-labelledby={`${id}-title`}
        >
          <h3 id={`${id}-title`}>{zh ? "外观" : "Appearance"}</h3>
          <fieldset>
            <legend>{zh ? "模式" : "Mode"}</legend>
            <div className="appearance-modes">
              {modes.map((mode) => (
                <label className="appearance-mode" key={mode.id}>
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    value={mode.id}
                    checked={preference.mode === mode.id}
                    onChange={() => select({ ...preference, mode: mode.id })}
                  />
                  <ModeIcon mode={mode.id} />
                  <span>{mode[language]}</span>
                  <span className="appearance-mode-check" aria-hidden="true">
                    ✓
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="appearance-status" role="status">
            {preference.mode === "system"
              ? `${zh ? "跟随设备" : "Following device"} · ${schemeName}`
              : `${schemeName} · ${zh ? "手动设置" : "Set manually"}`}
          </p>
          <fieldset>
            <legend>{zh ? "主题" : "Theme"}</legend>
            <div className="appearance-themes">
              {api.options.map((option) => (
                <label className="appearance-option" key={option.id}>
                  <input
                    type="radio"
                    name={`${id}-theme`}
                    value={option.id}
                    aria-label={option[language]}
                    checked={preference.theme === option.id}
                    onChange={() => select({ ...preference, theme: option.id })}
                  />
                  <span
                    className={`appearance-swatch theme-${option.id}`}
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                  <span className="appearance-name">{option[language]}</span>
                  <span className="appearance-selected" aria-hidden="true">
                    ✓
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {preference.theme === "glass" && (
            <label className="appearance-transparency">
              <input
                type="checkbox"
                checked={preference.reduceTransparency}
                onChange={(event) =>
                  select({
                    ...preference,
                    reduceTransparency: event.target.checked,
                  })
                }
              />
              {zh ? "减少透明效果" : "Reduce transparency"}
            </label>
          )}
          <p className="fine">
            {zh ? "仅保存在此设备。" : "Saved on this device."}
          </p>
        </section>
      )}
    </div>
  );
}
