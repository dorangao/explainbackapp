import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthInfo, Status, Post } from "./types";
import {
  activateStudioRecovery,
  currentStudioScope,
  recoveryScopeKey,
  storedStudioScope,
  revokeStudioRecovery,
} from "./studio-store";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public attemptsRemaining?: number,
    // Why a provider reply was rejected (validator message), when the server knows.
    public reason?: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  body?: unknown,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<T> {
  const timeout = AbortSignal.timeout(options?.timeoutMs ?? 15000);
  const response = await fetch(path, {
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal: options?.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout,
  });
  // Edge rate limits may return HTML instead of the application's JSON envelope.
  const data = await response.json().catch(() => {
    if (!response.ok) return {};
    throw new Error("Invalid server response.");
  });
  const wait = Number(data.retryAfter ?? response.headers.get("Retry-After"));
  if (!response.ok)
    throw new ApiError(
      data.error ||
        (response.status === 429
          ? "Too many requests. Please try again shortly."
          : "Request failed."),
      response.status,
      data.code || (response.status === 429 ? "API_RATE_LIMIT" : undefined),
      data.attemptsRemaining,
      typeof data.reason === "string" ? data.reason : undefined,
      Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : undefined,
    );
  return data as T;
}
// A plain GET with the session cookie; errors carry the server's message and status.
export const getJson = <T>(path: string) => request<T>(path);
export const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, body);
const signedOut: AuthInfo = {
  configured: false,
  codes: false,
  open: false,
  authenticated: false,
};
export function useAuth() {
  const [info, setInfo] = useState<AuthInfo>(signedOut),
    [status, setStatus] = useState<Status | null>(null),
    [loading, setLoading] = useState(true),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [judgeExpired, setJudgeExpired] = useState(false),
    [retryAt, setRetryAt] = useState<number>(),
    [identity, setIdentity] = useState(0);
  const version = useRef(0),
    mounted = useRef(true),
    authenticated = useRef(false),
    judgeDeadline = useRef<number | null>(null),
    recoveryScope = useRef<string | null>(null);
  const receiveStatus = useCallback((next: Status) => {
    judgeDeadline.current =
      next.access?.kind === "judge" ? next.access.expiresAt : null;
    setStatus(next);
  }, []);
  const loseAccess = useCallback((message = "") => {
    // Keep only a UI expiry flag; private status and recovery still get cleared.
    setJudgeExpired(
      message === "TESTER_REQUIRED" &&
        judgeDeadline.current !== null &&
        judgeDeadline.current <= Date.now(),
    );
    judgeDeadline.current = null;
    version.current++;
    authenticated.current = false;
    if (recoveryScope.current) revokeStudioRecovery(recoveryScope.current);
    recoveryScope.current = null;
    setInfo((i) => ({
      ...i,
      authenticated: false,
      admin: false,
      recoveryScope: undefined,
    }));
    setStatus(null);
    setError(message);
    setRetryAt(undefined);
    setIdentity((i) => i + 1);
    setWorking(false);
    setLoading(false);
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (
        (event.key === recoveryScopeKey || event.key === null) &&
        authenticated.current &&
        currentStudioScope() !== recoveryScope.current
      )
        loseAccess("TESTER_REQUIRED");
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [loseAccess]);
  const refresh = useCallback(async () => {
    const token = version.current;
    try {
      const next = await request<Status>("/api/status");
      if (mounted.current && token === version.current && authenticated.current)
        receiveStatus(next);
    } catch (e) {
      if (
        token === version.current &&
        e instanceof ApiError &&
        e.status === 401
      )
        loseAccess("TESTER_REQUIRED");
    }
  }, [loseAccess, receiveStatus]);
  // Fixed server expiry: refreshing never extends a trial. Poll for usage in other tabs.
  const judgeExpiry =
    status?.access?.kind === "judge" ? status.access.expiresAt : null;
  useEffect(() => {
    if (!judgeExpiry || !info.authenticated) return;
    const expiry = window.setTimeout(
      () => loseAccess("TESTER_REQUIRED"),
      Math.max(0, judgeExpiry - Date.now()),
    );
    const poll = window.setInterval(() => void refresh(), 15000);
    return () => {
      clearTimeout(expiry);
      clearInterval(poll);
    };
  }, [judgeExpiry, info.authenticated, loseAccess, refresh]);
  useEffect(() => {
    const mountedRef = mounted,
      versionRef = version;
    mountedRef.current = true;
    const token = ++versionRef.current;
    void (async () => {
      try {
        let auth: AuthInfo;
        for (;;) {
          const initialScope = storedStudioScope();
          auth = await request<AuthInfo>("/api/auth");
          if (!mounted.current || token !== version.current) return;
          // A newer login/sign-out supersedes this reply. Re-read the current
          // session so initialization still supplies the sign-in configuration.
          if (storedStudioScope() === initialScope) break;
        }
        if (auth.authenticated) activateStudioRecovery(auth.recoveryScope);
        else revokeStudioRecovery();
        recoveryScope.current = auth.recoveryScope ?? null;
        setInfo(auth);
        authenticated.current = auth.authenticated;
        if (auth.authenticated) {
          const next = await request<Status>("/api/status");
          if (mounted.current && token === version.current) receiveStatus(next);
        }
      } catch (failure) {
        if (mounted.current && token === version.current) {
          if (failure instanceof ApiError && failure.status === 401)
            loseAccess("TESTER_REQUIRED");
          else setError("NETWORK");
        }
      } finally {
        if (mounted.current && token === version.current) setLoading(false);
      }
    })();
    return () => {
      mountedRef.current = false;
      versionRef.current++;
    };
  }, [loseAccess, receiveStatus]);
  const login = useCallback(
    async (body: unknown) => {
      const token = ++version.current;
      const initialScope = storedStudioScope();
      setWorking(true);
      setError("");
      setRetryAt(undefined);
      let loginAccepted = false;
      try {
        const auth = await request<AuthInfo>("/api/login", body);
        loginAccepted = true;
        const next = await request<Status>("/api/status");
        if (!mounted.current || token !== version.current) return false;
        if (storedStudioScope() !== initialScope) return false;
        activateStudioRecovery(auth.recoveryScope);
        recoveryScope.current = auth.recoveryScope ?? null;
        authenticated.current = true;
        setInfo((i) => ({
          ...i,
          authenticated: true,
          admin: auth.admin === true,
          recoveryScope: auth.recoveryScope,
        }));
        receiveStatus(next);
        setJudgeExpired(false);
        setIdentity((i) => i + 1);
        return true;
      } catch (e) {
        if (mounted.current && token === version.current) {
          // A rejected trial restart leaves its existing cookie and workspace valid.
          if (
            e instanceof ApiError &&
            !loginAccepted &&
            (e.status === 429 ||
              ["JUDGE_DISABLED", "JUDGE_CHALLENGE"].includes(e.code ?? ""))
          ) {
            setError(e.code || "API_RATE_LIMIT");
            setRetryAt(
              e.retryAfter ? Date.now() + e.retryAfter * 1000 : undefined,
            );
            return false;
          }
          authenticated.current = false;
          setInfo((i) => ({ ...i, authenticated: false, admin: false }));
          setStatus(null);
          setError(e instanceof ApiError ? e.code || "NETWORK" : "NETWORK");
        }
        return false;
      } finally {
        if (mounted.current && token === version.current) setWorking(false);
      }
    },
    [receiveStatus],
  );
  const logout = useCallback(async () => {
    const token = ++version.current;
    setWorking(true);
    try {
      await request("/api/logout", {});
      if (mounted.current && token === version.current) loseAccess();
    } catch {
      if (mounted.current && token === version.current) {
        setError("NETWORK");
        setWorking(false);
      }
    }
  }, [loseAccess]);
  const post: Post = useCallback(
    async <T>(
      path: string,
      body: unknown,
      options?: { timeoutMs?: number; signal?: AbortSignal },
    ) => {
      const token = version.current;
      try {
        return await request<T>(path, body, options);
      } catch (e) {
        if (
          token === version.current &&
          e instanceof ApiError &&
          e.status === 401
        )
          loseAccess("TESTER_REQUIRED");
        throw e;
      } finally {
        if (
          token === version.current &&
          [
            "/api/turn",
            "/api/studio/compose",
            "/api/studio/guide",
            "/api/studio/ground",
            "/api/studio/compare",
            "/api/studio/tryout",
            "/api/studio/show",
            "/api/studio/illustrate",
            "/api/studio/cover",
            "/api/studio/judge",
            "/api/studio/detect",
            "/api/studio/transcribe",
            "/api/quantum/explain",
          ].includes(path)
        )
          void refresh();
      }
    },
    [loseAccess, refresh],
  );
  return {
    info,
    status,
    loading,
    working,
    error,
    judgeExpired,
    retryAt,
    identity,
    login,
    logout,
    post,
    // Re-reads /api/status, for example to update the hourly budget after a request.
    refresh,
  };
}
