import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useEffect, useReducer } from "react";

// A controllable stand-in for useAuth: login flips the signed-in state and re-renders.
const state = { authenticated: false, logins: [] as string[] };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
vi.mock("./lib/api", () => ({
  ApiError: class extends Error {},
  getJson: async () => ({ lessons: [] }),
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

describe("phone menu", () => {
  it("folds the navigation behind a Menu button that closes again on navigation", async () => {
    render(<App />);
    const header = document.querySelector(".site-header");
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(header?.getAttribute("data-menu")).toBe("closed");
    fireEvent.click(button);
    expect(header?.getAttribute("data-menu")).toBe("open");
    expect(screen.getByRole("button", { name: "Close menu" })).toBeTruthy();
    // Following a link closes the menu once the route changes.
    await act(async () => {
      location.hash = "#about";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() =>
      expect(header?.getAttribute("data-menu")).toBe("closed"),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "About ExplainBack" }),
    ).toBeTruthy();
  });
  it("Sign in from the menu folds it, scrolls the access panel into view and focuses the code field", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    render(<App />);
    const header = document.querySelector(".site-header");
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(header?.getAttribute("data-menu")).toBe("open");
    fireEvent.click(
      within(document.querySelector(".site-menu") as HTMLElement).getByRole(
        "button",
        { name: "Sign in" },
      ),
    );
    expect(header?.getAttribute("data-menu")).toBe("closed");
    const panel = document.querySelector(".access-panel");
    expect(panel).toBeTruthy();
    await waitFor(() => expect(scrolled).toHaveBeenCalledTimes(1));
    expect(scrolled.mock.instances[0]).toBe(panel?.parentElement);
    expect(document.activeElement?.id).toBe("reviewer-code");
  });
});

describe("back to top", () => {
  it("appears after a long scroll, scrolls the page up and hands focus to the content", async () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, "scrollY", {
      value: 2000,
      configurable: true,
    });
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(document.activeElement?.id).toBe("main-content");
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.queryByRole("button", { name: "Back to top" })).toBeNull();
  });
});
describe("the tour's play link", () => {
  it("opens the gallery show already playing when the hash ends in /play", async () => {
    location.hash = "#show:explainback/play";
    render(<App />);
    expect(
      await screen.findByRole("button", { name: "Pause" }, { timeout: 5000 }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "How ExplainBack makes a lesson",
      }),
    ).toBeTruthy();
  });
});
