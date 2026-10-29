import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, useReducer } from "react";

// A controllable stand-in for useAuth: login flips the signed-in state and re-renders.
const state = { authenticated: false, logins: [] as string[] };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
vi.mock("./lib/api", () => ({
  ApiError: class extends Error {},
  useAuth: () => {
    const [, force] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      listeners.add(force);
      return () => {
        listeners.delete(force);
      };
    }, []);
    return {
      info: {
        configured: true,
        codes: true,
        open: false,
        authenticated: state.authenticated,
      },
      status: null,
      loading: false,
      working: false,
      error: "",
      identity: 0,
      login: async (body: { code?: string }) => {
        state.logins.push(body.code ?? "");
        state.authenticated = true;
        notify();
        return true;
      },
      logout: async () => {
        state.authenticated = false;
        notify();
      },
      post: async () => ({ records: [] }),
    };
  },
}));
import { App } from "./App";

afterEach(() => {
  cleanup();
  state.authenticated = false;
  state.logins = [];
  history.replaceState(null, "", "#studio");
});

describe("invite links", () => {
  it("signs in from an #invite: link, and again when the same link is reused after sign-out", async () => {
    location.hash = "#invite:JUDGE-TESTCODE";
    render(<App />);
    await waitFor(() => expect(state.logins).toEqual(["JUDGE-TESTCODE"]));
    expect(location.hash).toBe("#create");
    expect(
      await screen.findByRole("button", { name: /Sign out/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Sign out/ })).toBeNull(),
    );
    // The judge clicks the same invite link in the same tab.
    await act(async () => {
      location.hash = "#invite:JUDGE-TESTCODE";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() =>
      expect(state.logins).toEqual(["JUDGE-TESTCODE", "JUDGE-TESTCODE"]),
    );
    expect(
      await screen.findByRole("button", { name: /Sign out/ }),
    ).toBeTruthy();
    // Auth changes alone do not replay a consumed invite.
    await act(async () => {
      notify();
    });
    expect(state.logins).toHaveLength(2);
  });
});
