import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { t } from "../lib/messages";
import type { Language } from "../lib/types";

const farEnough = () =>
  typeof window !== "undefined" && window.scrollY > window.innerHeight * 1.5;

// A fixed "Back to top" control, on both layouts, once the page has scrolled past a
// screen and a half. It scrolls up (smoothly unless motion is reduced) and hands focus
// to the main landmark, so keyboard and screen-reader users land with the page.
export function BackToTop({
  language,
  target,
}: {
  language: Language;
  target?: RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState(farEnough);
  useEffect(() => {
    const update = () => setShown(farEnough());
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  if (!shown) return null;
  return (
    <button
      type="button"
      className="back-to-top"
      onClick={() => {
        const reduce = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        target?.current?.focus({ preventScroll: true });
      }}
    >
      <span aria-hidden="true">↑</span> {t(language, "App.backToTop")}
    </button>
  );
}
