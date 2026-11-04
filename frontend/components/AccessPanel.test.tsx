import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AccessPanel } from "./AccessPanel";
describe("Judge mode access", () => {
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
  it("explains the start throttle without offering an automatic retry", () => {
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
        onLogin={vi.fn()}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/hour/);
  });
});
