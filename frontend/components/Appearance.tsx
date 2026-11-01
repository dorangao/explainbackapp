import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../lib/types";
import type { AppearancePreference } from "../../public/appearance.js";
// oxlint-disable-next-line import/no-unassigned-import -- idempotent fallback for the synchronous head script
import "../../public/appearance.js";

export function Appearance({ language }: { language: Language }) {
  const api = window.explainbackAppearance;
  const [preference, setPreference] = useState(api.read);
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
  const select = (next: AppearancePreference) =>
    setPreference(api.select(next));
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
        <div className="appearance-panel" id={id}>
          <fieldset>
            <legend>{zh ? "主题" : "Theme"}</legend>
            {api.options.map((option) => (
              <label className="appearance-option" key={option.id}>
                <input
                  type="radio"
                  name={`${id}-theme`}
                  value={option.id}
                  checked={preference.theme === option.id}
                  onChange={() => select({ ...preference, theme: option.id })}
                />
                <span
                  className={`appearance-swatch theme-${option.id}`}
                  aria-hidden="true"
                />
                <span>
                  {option[language]}
                  {option.id === "paper" && (
                    <>
                      {" "}
                      <small>{zh ? "默认" : "Default"}</small>
                    </>
                  )}
                </span>
              </label>
            ))}
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
        </div>
      )}
    </div>
  );
}
