import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { JudgeUsage } from "./JudgeUsage";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requires a reason and confirmation, then refreshes totals and reset history", async () => {
  let reset = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            sessions: [],
            cursor: null,
            retentionDays: 7,
            daily: {
              date: "2026-11-03",
              used: reset ? 0 : 500,
              total: 500,
              limit: 500,
            },
            resets: reset
              ? [
                  {
                    type: "daily",
                    at: Date.now(),
                    reason: "Demo recovery",
                    previousUsed: 500,
                  },
                ]
              : [],
          }),
        ),
    ),
  );
  const post = vi.fn(async () => {
    reset = true;
    return { ok: true };
  });
  render(<JudgeUsage language="en" onClose={() => {}} post={post as never} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Reset daily allowance" }),
  );
  const button = screen.getByRole("button", {
    name: "Confirm reset",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Reason for reset"), {
    target: { value: "Demo recovery" },
  });
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("I confirm this reset"));
  await act(async () => fireEvent.click(button));
  expect(post).toHaveBeenCalledWith("/api/admin/judge-reset", {
    type: "daily",
    reason: "Demo recovery",
    confirm: true,
  });
  await waitFor(() =>
    expect(screen.getByText(/Total provider calls today: 500/)).toBeTruthy(),
  );
  expect(screen.getByText(/Demo recovery/)).toBeTruthy();
  expect(screen.getByText("0 / 500")).toBeTruthy();
});
