import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useProviderSession } from "./useProviderSession";
afterEach(cleanup);
it("shows the shared Judge allowance on reload and reflects an administrator reset", () => {
  const post = vi.fn().mockResolvedValue({}),
    onBusy = vi.fn();
  const { result, rerender } = renderHook(
    ({ allowance }) =>
      useProviderSession({ post, language: "en", onBusy, allowance }),
    { initialProps: { allowance: 49 } },
  );
  expect(result.current.remaining).toBe(49);
  rerender({ allowance: 0 });
  expect(result.current.remaining).toBe(0);
  rerender({ allowance: 50 });
  expect(result.current.remaining).toBe(50);
  expect(post).not.toHaveBeenCalled();
});
