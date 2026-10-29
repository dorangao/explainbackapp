// The judge path's step states, derived from what the Studio already has. Pure, so the
// rule "a present result is done and costs nothing" is testable without rendering.
export type JudgeStepId =
  "draft" | "tryout" | "show" | "illustrate" | "save" | "share";
export type JudgeStep = {
  id: JudgeStepId;
  // "done": the result is present (made now or reused from the cache).
  // "todo": one click runs it. "unavailable": this server lacks the model for it.
  state: "done" | "todo" | "unavailable";
  // Whether running it now would make a model request.
  request: boolean;
};
export function judgeStepStates(input: {
  hasDraft: boolean;
  tryoutFresh: boolean;
  showFresh: boolean;
  illustrated: boolean;
  imagesAvailable: boolean;
  saved: boolean;
  shared: boolean;
}): JudgeStep[] {
  const { hasDraft, tryoutFresh, showFresh } = input;
  return [
    { id: "draft", state: hasDraft ? "done" : "todo", request: true },
    {
      id: "tryout",
      state: hasDraft && tryoutFresh ? "done" : "todo",
      request: !tryoutFresh,
    },
    {
      id: "show",
      state: hasDraft && showFresh ? "done" : "todo",
      request: !showFresh,
    },
    {
      id: "illustrate",
      state: !input.imagesAvailable
        ? "unavailable"
        : hasDraft && showFresh && input.illustrated
          ? "done"
          : "todo",
      request: true,
    },
    { id: "save", state: input.saved ? "done" : "todo", request: false },
    { id: "share", state: input.shared ? "done" : "todo", request: false },
  ];
}
// Why no request can be made now, if anything blocks it: the hourly budget of the
// access, or the provider session's own cap. Steps that make no request still run.
export function judgeBlocker(
  steps: JudgeStep[],
  hourlyRemaining: number | null,
  sessionRemaining: number,
): null | "session" | "hour" {
  if (steps.every((s) => !s.request || s.state !== "todo")) return null;
  if (hourlyRemaining !== null && hourlyRemaining <= 0) return "hour";
  return sessionRemaining <= 0 ? "session" : null;
}
