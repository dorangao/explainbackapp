import { useEffect, useRef, useState, useId } from "react";
import { mountProviderConsole } from "../../public/provider-console.mjs";
import type { Language, Post } from "../lib/types";
export function ProviderConsole({
  post,
  language,
  enabled,
  sessionId,
  busy,
  followLatest = false,
  refreshKey = 0,
  open,
  onToggle,
  className = "react-console",
}: {
  post: Post;
  language: Language;
  enabled: boolean;
  sessionId: string | null;
  busy: boolean;
  /** Scroll the newest record into view while a scripted run is active. */
  followLatest?: boolean;
  /** Increment to request one explicit refresh (after a completed request). */
  refreshKey?: number;
  /** Controlled disclosure state; omit to let the browser own it. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  className?: string;
}) {
  const prefix = "studio-trace-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const active = enabled && pageVisible;
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const element = useRef<HTMLDetailsElement>(null);
  const controller = useRef<ReturnType<typeof mountProviderConsole> | null>(
    null,
  );
  useEffect(() => {
    if (!element.current) return;
    const mounted = mountProviderConsole(element.current, post, {
      prefix,
    });
    controller.current = mounted;
    return () => {
      mounted.destroy();
      controller.current = null;
    };
  }, [post, prefix]);
  useEffect(() => {
    controller.current?.set({
      enabled: active,
      sessionId,
      language,
      followLatest,
    });
    if (active && sessionId) void controller.current?.refresh();
    // refreshKey lets callers request one refresh after a completed request.
  }, [active, sessionId, language, followLatest, refreshKey]);
  useEffect(() => {
    if (!busy || !active || !sessionId) return;
    const id = setInterval(() => void controller.current?.refresh(), 1000);
    return () => clearInterval(id);
  }, [busy, active, sessionId]);
  useEffect(() => {
    if (open !== undefined && element.current) element.current.open = open;
  }, [open]);
  return (
    <details
      ref={element}
      className={`provider-console ${className}`}
      hidden={!enabled}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    />
  );
}
