import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./api";
import {
  activateStudioRecovery,
  recoveryScopeKey,
  revokeStudioRecovery,
} from "./studio-store";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it.each(["newer-login", null])(
  "initial auth follows another tab's current login scope (%s)",
  async (scope) => {
    let release!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    let firstAuth = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path === "/api/auth") {
          if (firstAuth) {
            firstAuth = false;
            return pending;
          }
          return new Response(
            JSON.stringify({
              authenticated: scope !== null,
              configured: true,
              codes: true,
              open: false,
              ...(scope === null ? {} : { recoveryScope: scope }),
            }),
          );
        }
        return new Response(
          JSON.stringify({
            configured: true,
            models: [],
            problems: [],
            traceEnabled: false,
            defaultModel: "test",
            access: null,
          }),
        );
      }),
    );
    activateStudioRecovery("older-login");
    const { result } = renderHook(() => useAuth());
    if (scope === null) revokeStudioRecovery();
    else activateStudioRecovery(scope);
    window.dispatchEvent(
      new StorageEvent("storage", { key: recoveryScopeKey, newValue: scope }),
    );
    await act(async () => {
      release(
        new Response(
          JSON.stringify({
            authenticated: true,
            configured: true,
            codes: true,
            open: false,
            recoveryScope: "older-login",
          }),
        ),
      );
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(localStorage.getItem(recoveryScopeKey)).toBe(scope);
    expect(result.current.info.configured).toBe(true);
    expect(result.current.info.codes).toBe(true);
    expect(result.current.info.authenticated).toBe(scope !== null);
    expect(result.current.info.recoveryScope).toBe(scope ?? undefined);
    expect(result.current.status === null).toBe(scope === null);
  },
);

it("a pending sign-in cannot replace another tab's newer recovery login", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/auth")
        return new Response(JSON.stringify({ authenticated: false }));
      if (path === "/api/login")
        return new Response(
          JSON.stringify({ authenticated: true, recoveryScope: "older-login" }),
        );
      return pending;
    }),
  );
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let signingIn!: Promise<boolean>;
  act(() => {
    signingIn = result.current.login({ code: "synthetic" });
  });
  await waitFor(() => expect(result.current.working).toBe(true));
  activateStudioRecovery("newer-login");
  await act(async () => {
    release(new Response(JSON.stringify({ configured: true })));
    await signingIn;
  });
  expect(localStorage.getItem(recoveryScopeKey)).toBe("newer-login");
  expect(result.current.info.authenticated).toBe(false);
});

it("expiry during initial status loading revokes private recovery", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      path === "/api/auth"
        ? new Response(
            JSON.stringify({
              authenticated: true,
              recoveryScope: "expired-login",
            }),
          )
        : new Response(
            JSON.stringify({ error: "Expired", code: "TESTER_REQUIRED" }),
            { status: 401 },
          ),
    ),
  );
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.info.authenticated).toBe(false);
  expect(localStorage.getItem(recoveryScopeKey)).toBeNull();
});

it("a late logout completion cannot clear another tab's new recovery login", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/auth")
        return new Response(
          JSON.stringify({ authenticated: true, recoveryScope: "older-login" }),
        );
      if (path === "/api/logout") return pending;
      return new Response(JSON.stringify({ configured: true }));
    }),
  );
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  let signingOut!: Promise<void>;
  act(() => {
    signingOut = result.current.logout();
  });
  await act(async () => {
    activateStudioRecovery("newer-login");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: recoveryScopeKey,
        newValue: "newer-login",
      }),
    );
  });
  await act(async () => {
    release(new Response(JSON.stringify({ authenticated: false })));
    await signingOut;
  });
  expect(localStorage.getItem(recoveryScopeKey)).toBe("newer-login");
});

it("judge restarts remount private work and a throttled start preserves the current session", async () => {
  let scope = "first-judge",
    denied = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/login") {
        if (denied)
          return new Response(JSON.stringify({ code: "JUDGE_START_LIMIT" }), {
            status: 429,
          });
        scope = "new-judge";
      }
      if (path !== "/api/status")
        return new Response(
          JSON.stringify({
            configured: true,
            codes: false,
            open: false,
            authenticated: true,
            judgeMode: true,
            admin: false,
            recoveryScope: scope,
          }),
        );
      return new Response(
        JSON.stringify({
          access: {
            kind: "judge",
            expiresAt: Date.now() + 1800000,
            remaining: 50,
            quota: 50,
          },
        }),
      );
    }),
  );
  const { result } = renderHook(() => useAuth());
  await waitFor(() => expect(result.current.loading).toBe(false));
  const identity = result.current.identity;
  await act(async () => {
    await result.current.login({ judge: true });
  });
  expect(result.current.identity).toBeGreaterThan(identity);
  expect(result.current.info.recoveryScope).toBe("new-judge");
  denied = true;
  await act(async () => {
    await result.current.login({ judge: true });
  });
  expect(result.current.info.authenticated).toBe(true);
  expect(result.current.info.admin).toBe(false);
  expect(result.current.status?.access?.remaining).toBe(50);
  expect(result.current.error).toBe("JUDGE_START_LIMIT");
});
