// How hard each Studio step asks the model to think (Meta's `reasoning.effort`; Ollama
// ignores it). Reasoning tokens count against the output budget and add latency before the
// first byte, so each step gets the lowest level that still gives acceptable results:
// - Learner turns (tryout, explain-back guide) read a lesson and answer in a fixed schema.
//   Measured live on Spark (Oct 29 2026): `minimal` was 25–40 % faster than `low` with the
//   same checked transfer answer, the same verdict on a wrong explanation and a follow-up
//   question of the same shape; output (mostly reasoning) tokens fell by about 40 %.
// - Author turns (compose, revise, show) invent content under a long contract with many
//   cross-field constraints; they keep `low`, which the frozen evaluation suite was run at.
//   Measured the same day on Wonder: the show at `minimal` was 4–5 s faster but its
//   narration echoed the instructions ("watch what the learner should notice", "invite
//   yourself to try") instead of speaking to the learner, and the show is what the camera
//   sees; compose at `medium` was 6 s slower with the same one-chapter model lesson.
// `none` is rejected by Muse Wonder and Muse Spark, so nothing here uses it.
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
