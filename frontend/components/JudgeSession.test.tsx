import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { JudgeSession } from "./JudgeSession";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("offers restart only after calls run out, and hides it again after an admin reset", () => {
  const access = {
    kind: "judge" as const,
    label: "synthetic",
    remaining: 1,
    quota: 50,
    expiresAt: Date.now() + 60000,
  };
  const onRestart = vi.fn();
  const { rerender } = render(
    <JudgeSession
      access={access}
      language="en"
      working={false}
      onRestart={onRestart}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "New judge session" }),
  ).toBeNull();
  rerender(
    <JudgeSession
      access={{ ...access, remaining: 0 }}
      language="en"
      working={false}
      onRestart={onRestart}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "New judge session" }));
  expect(onRestart).toHaveBeenCalledOnce();
  rerender(
    <JudgeSession
      access={access}
      language="en"
      working={false}
      onRestart={onRestart}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "New judge session" }),
  ).toBeNull();
});

it("offers restart when the countdown expires even with calls left", () => {
  vi.useFakeTimers();
  const access = {
    kind: "judge" as const,
    label: "synthetic",
    remaining: 50,
    quota: 50,
    expiresAt: Date.now() + 1000,
  };
  render(
    <JudgeSession
      access={access}
      language="zh"
      working={false}
      onRestart={() => {}}
    />,
  );
  expect(screen.queryByRole("button", { name: "新建评审会话" })).toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("button", { name: "新建评审会话" })).toBeTruthy();
});
