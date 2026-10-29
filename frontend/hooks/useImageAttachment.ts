import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../lib/messages";
import { prepareImage } from "../lib/image";
import type { Language } from "../lib/types";
import { say } from "../lib/types";

export type Attached = { name: string; dataUrl: string };

// A learner image prepared in the browser. Nothing leaves the page until the caller
// includes `image.dataUrl` in an explicit create request.
export function useImageAttachment(language: Language) {
  const [image, setImage] = useState<Attached | null>(null),
    [loading, setLoading] = useState(false),
    [notice, setNotice] = useState("");
  const epoch = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const epochRef = epoch;
    return () => {
      alive.current = false;
      epochRef.current++;
    };
  }, []);
  const clear = useCallback(() => {
    epoch.current++;
    setImage(null);
    setLoading(false);
    setNotice("");
  }, []);
  const attach = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const token = ++epoch.current;
      setLoading(true);
      setNotice("");
      try {
        const prepared = await prepareImage(file);
        if (alive.current && token === epoch.current) {
          setImage(prepared);
          setNotice(t(language, "useImageAttachment.imageAttachedItWillBe"));
        }
      } catch (error) {
        if (alive.current && token === epoch.current) {
          setImage(null);
          const size = error instanceof Error && error.message === "size";
          setNotice(
            say(
              language,
              size
                ? "Choose an image under 12 MB that can be reduced to about 1 MB."
                : "Choose a readable PNG, JPEG, WebP or GIF image.",
              size
                ? "请选择小于 12 MB、可缩小到约 1 MB 的图片。"
                : "请选择可读取的 PNG、JPEG、WebP 或 GIF 图片。",
            ),
          );
        }
      } finally {
        if (alive.current && token === epoch.current) setLoading(false);
      }
    },
    [language],
  );
  return { image, loading, notice, attach, clear };
}
