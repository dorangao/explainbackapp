import { useEffect, useReducer, useRef } from "react";
// The labs were written as imperative controllers whose asynchronous flows
// (provider requests, scripted demos, playback) read and write shared state
// between awaits. A single mutable store with an explicit `render()` keeps
// those flows readable; React renders the current snapshot after each call.
export function useLabStore<T extends object>(create: () => T) {
  const store = useRef<T | null>(null);
  if (store.current === null) store.current = create();
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const render = useRef(() => bump()).current;
  return [store.current, render] as const;
}
// Work that must run against the committed DOM (focus, scrolling) is queued
// by handlers and flushed after the next commit.
export function useAfterRender(queue: Array<() => void>) {
  useEffect(() => {
    const jobs = queue.splice(0, queue.length);
    for (const job of jobs) job();
  });
}
