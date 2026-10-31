// How hard each Studio step asks the model to think (Meta's `reasoning.effort`; Ollama
// ignores it). Reasoning tokens count against the output budget and add latency before the
// first byte. The current per-role settings are:
// - Learner turns (tryout, explain-back guide) read a lesson and answer in a fixed schema.
//   They use `minimal`.
// - Author turns (compose, revise, show) invent content under a long contract with many
//   cross-field constraints; they use `low`.
// Measured comparisons belong in private evaluation notes. These settings do not
// establish content quality or latency guarantees, and no step requests `none`.
const efforts = Object.freeze({
  compose: 'low',
  guide: 'minimal',
  tryout: 'minimal',
  show: 'low',
});
export const reasoningEffortFor = mode => {
  const effort = efforts[mode];
  if (!effort) throw new Error(`No reasoning effort for mode ${String(mode)}.`);
  return effort;
};
