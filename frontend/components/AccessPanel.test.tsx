import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { AccessPanel } from "./AccessPanel";
describe("Judge mode access", () => {
  beforeEach(() =>
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "synthetic-check",
              kind: "image",
              image: "data:image/png;base64,AA==",
              expiresAt: Date.now() + 300000,
            }),
          ),
      ),
    ),
  );
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("starts only on an explicit click after the quick check, with no credentials", async () => {
    const login = vi.fn().mockResolvedValue(true);
    render(
      <AccessPanel
        language="en"
        info={{
          configured: false,
          codes: false,
          open: false,
          authenticated: false,
          judgeMode: true,
        }}
        working={false}
        error=""
        onLogin={login}
        onClose={() => {}}
      />,
    );
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByText(/30 minutes/)).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Enter the five digits"), {
      target: { value: "24680" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start Judge mode" }));
    expect(login).toHaveBeenCalledWith({
      judge: true,
      challengeId: "synthetic-check",
      answer: "24680",
    });
    expect(screen.queryByText(/not configured/i)).toBeNull();
  });
  it.each(["rate", "disabled"])(
    "handles a %s response while loading the quick check",
    async (failure) => {
      vi.useFakeTimers();
      const fetcher = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code:
              failure === "rate" ? "JUDGE_CHALLENGE_RATE" : "JUDGE_DISABLED",
            retryAfter: 28,
          }),
          { status: failure === "rate" ? 429 : 403 },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      render(
        <AccessPanel
          language="en"
          info={{
            configured: false,
            codes: false,
            open: false,
            authenticated: false,
            judgeMode: true,
          }}
          working={false}
          error=""
          onLogin={vi.fn()}
          onClose={() => {}}
        />,
      );
      await act(async () => {});
      const newCheck = screen.getByRole("button", {
        name: "New image",
      }) as HTMLButtonElement;
      expect(newCheck.disabled).toBe(true);
      expect(screen.getByRole("status").textContent).toMatch(
        failure === "rate"
          ? /28 seconds/
          : /Judge mode is currently unavailable/,
      );
      fireEvent.click(newCheck);
      expect(fetcher).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(28000));
      expect(newCheck.disabled).toBe(failure === "disabled");
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("shows the actual cooldown and enables an explicit retry when it ends", async () => {
    vi.useFakeTimers();
    const login = vi.fn();
    render(
      <AccessPanel
        language="en"
        info={{
          configured: false,
          codes: false,
          open: false,
          authenticated: false,
          judgeMode: true,
        }}
        working={false}
        error="JUDGE_START_LIMIT"
        retryAt={Date.now() + 28000}
        onLogin={login}
        onClose={() => {}}
      />,
    );
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Enter the five digits"), {
      target: { value: "24680" },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/28 seconds/);
    expect(
      (
        screen.getByRole("button", {
          name: "Start Judge mode",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    act(() => vi.advanceTimersByTime(28000));
    expect(screen.getByRole("alert").textContent).toMatch(/try again now/i);
    expect(
      (
        screen.getByRole("button", {
          name: "Start Judge mode",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });
});
