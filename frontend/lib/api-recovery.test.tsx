import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "./api";
import { activateStudioRecovery, recoveryScopeKey } from "./studio-store";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it("a late initial auth reply cannot replace another tab's newer recovery login", async () => {
  let release!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      path === "/api/auth"
        ? pending
        : new Response(
            JSON.stringify({
              configured: true,
              models: [],
              problems: [],
              traceEnabled: false,
              defaultModel: "test",
              access: null,
            }),
          ),
    ),
  );
  activateStudioRecovery("older-login");
  const { result } = renderHook(() => useAuth());
  activateStudioRecovery("newer-login");
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
  expect(localStorage.getItem(recoveryScopeKey)).toBe("newer-login");
  expect(result.current.info.authenticated).toBe(false);
});

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
