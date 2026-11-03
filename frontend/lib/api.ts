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
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || "Request failed.",
      response.status,
      data.code,
      data.attemptsRemaining,
      typeof data.reason === "string" ? data.reason : undefined,
    );
  return data as T;
}
// A plain GET with the session cookie; errors carry the server's message and status.
export const getJson = <T>(path: string) => request<T>(path);
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
    [identity, setIdentity] = useState(0);
  const version = useRef(0),
    mounted = useRef(true),
    authenticated = useRef(false),
    recoveryScope = useRef<string | null>(null);
  const loseAccess = useCallback((message = "") => {
    version.current++;
    authenticated.current = false;
    if (recoveryScope.current) revokeStudioRecovery(recoveryScope.current);
    recoveryScope.current = null;
    setInfo((i) => ({ ...i, authenticated: false, recoveryScope: undefined }));
    setStatus(null);
    setError(message);
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
        setStatus(next);
    } catch (e) {
      if (
        token === version.current &&
        e instanceof ApiError &&
        e.status === 401
      )
        loseAccess("TESTER_REQUIRED");
    }
  }, [loseAccess]);
  useEffect(() => {
    const mountedRef = mounted,
      versionRef = version;
    mountedRef.current = true;
    const token = ++versionRef.current;
    const initialScope = storedStudioScope();
    void (async () => {
      try {
        const auth = await request<AuthInfo>("/api/auth");
        if (!mounted.current || token !== version.current) return;
        // A newer login/sign-out in another tab supersedes this pending reply.
        if (storedStudioScope() !== initialScope) return;
        if (auth.authenticated) activateStudioRecovery(auth.recoveryScope);
        else revokeStudioRecovery();
        recoveryScope.current = auth.recoveryScope ?? null;
        setInfo(auth);
        authenticated.current = auth.authenticated;
        if (auth.authenticated) {
          const next = await request<Status>("/api/status");
          if (mounted.current && token === version.current) setStatus(next);
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
  }, [loseAccess]);
  const login = useCallback(async (body: unknown) => {
    const token = ++version.current;
    const initialScope = storedStudioScope();
    setWorking(true);
    setError("");
    try {
      const auth = await request<AuthInfo>("/api/login", body);
      const next = await request<Status>("/api/status");
      if (!mounted.current || token !== version.current) return false;
      if (storedStudioScope() !== initialScope) return false;
      activateStudioRecovery(auth.recoveryScope);
      recoveryScope.current = auth.recoveryScope ?? null;
      authenticated.current = true;
      setInfo((i) => ({
        ...i,
        authenticated: true,
        recoveryScope: auth.recoveryScope,
      }));
      setStatus(next);
      return true;
    } catch (e) {
      if (mounted.current && token === version.current) {
        authenticated.current = false;
        setInfo((i) => ({ ...i, authenticated: false }));
        setStatus(null);
        setError(e instanceof ApiError ? e.code || "NETWORK" : "NETWORK");
      }
      return false;
    } finally {
      if (mounted.current && token === version.current) setWorking(false);
    }
  }, []);
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
    identity,
    login,
    logout,
    post,
    // Re-reads /api/status, for example to update the hourly budget after a request.
    refresh,
  };
}
