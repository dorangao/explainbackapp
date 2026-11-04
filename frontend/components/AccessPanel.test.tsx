import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { AccessPanel } from "./AccessPanel";
describe("Judge mode access", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it("starts only on an explicit click, with no credential fields required", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Start Judge mode" }));
    expect(login).toHaveBeenCalledWith({ judge: true });
    expect(screen.queryByText(/not configured/i)).toBeNull();
  });
  it("shows the actual cooldown and enables an explicit retry when it ends", () => {
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
