# Coached stages: optional Muse operations in the lesson contract

Design, October 31, 2026 Pacific. Nothing in this document is implemented; it describes how
a generated lesson could carry the coaching that today exists only in the two hand-built
benches, and what would have to change for that. Once the work lands, the parts that
describe behaviour move into `docs/lesson-library.md` and `docs/architecture.md`, and the
phase plan leaves this public repository.

## The ladder today

The layout redesign framed the library as rungs of one ladder:

| Rung | What it is | What Muse does while the learner plays |
| --- | --- | --- |
| 1 | Self-checked lesson: a contract (`public/lesson-schema.mjs`) run by the generic player (`public/lesson-player.mjs`, `frontend/components/LessonPlayer.tsx`) through Predict, Experiment, Explain, Transfer | Nothing. Every number comes from code. A signed-in visitor may ask Muse to explain the result or to read their explanation (`/api/studio/guide`), but the lesson does not know about it |
| 2 | The same lesson with a narrated show | Nothing at play time; the show script was written before |
| 3 | Coached lesson | Does not exist yet |
| 4 | Bench (`frontend/components/labs/PhysicsLab.tsx`, `QuantumLab.tsx`): hand-built sessions on `/api/session`, `/api/turn`, `/api/claim`, `/api/replay` and `/api/quantum/explain` | Confirms the learner's claim, picks and runs a checked experiment, reads the reasoning, asks the next question, cites replayable evidence, writes a transfer report |

Rung 3 is the gap this design fills: a lesson contract may declare, per player stage, one
operation that Muse performs, and the player renders that operation inline at that stage
for a signed-in learner while the self-checked path stays open to everyone.

Three rules carry over from the benches and the Studio guide route and are not negotiable:

1. **Code marks numbers; the model comments on wording.** The model never computes a value
   that is shown as checked, never receives a transfer answer before the learner has it
   right, and never sees a result before the learner has run the experiment.
2. **An operation the contract does not declare cannot run.** The server reads the declared
   operations from the lesson it receives, the same way the bench offers the model only the
   tools the current phase allows (`claimTools` in `src/claim-testing.mjs`).
3. **Coaching never blocks the ladder.** The player's gates (`next()` in
   `public/lesson-player.mjs`) do not change. A visitor who is signed out, out of budget or
   simply uninterested completes the lesson exactly as today.

## 1. The operations

One operation per stage. The Experiment stage has none on purpose: in a lesson the
chapter's experiment is fixed and the learner runs it, so a model call there would spend
budget to decide nothing. The bench's `run_experiment` exists because the model there
chooses among several catalog experiments; see section 5.

| Stage | Operation | Route | Model? | What the learner gets |
| --- | --- | --- | --- | --- |
| Predict | `confirm-claim` | `POST /api/studio/claim`, then `POST /api/studio/confirm` | yes, then no | Muse restates the learner's own claim in one sentence; the learner confirms or revises it locally |
| Explain | `coach` | `POST /api/studio/guide` (extended when the lesson declares it) | yes | A verdict on the learner's explanation that quotes their words, cites a replayable evidence record, and asks one follow-up question |
| Transfer | `check-reasoning` | `POST /api/studio/reasoning` | yes, only after code has marked the answer right | A reading of how the learner got the number, compared with their first explanation, and a transfer report whose outcome code decides |
| Complete | `next-question` | `POST /api/studio/next` | yes | For a model chapter, one fresh case Muse words and code marks; for a catalog or process chapter, one open question that is not marked |
| any, after Explain | evidence replay | `POST /api/studio/replay` | no | Re-runs the checked computation behind a cited record and confirms it has not changed: zero model requests, the same as the bench's `replayClaimEvidence` |

All model operations run on the `lesson-studio` session the Studio component already
creates (`/api/studio/session`), so they share its lock, its eight-attempt cap, the hourly
budget bucket (`budgetFor` in `src/access-codes.mjs`), the trace plumbing and the
redaction of provider errors. They use the tester role (Spark) like the guide route does
today; the author chain is never reused. A new chain key, `<model>:coach`, keeps the
coach's own turns together and separate from the tryout learner's chain, for the same
reason the learner chain never inherits the author's conversation.

### What the server keeps per session

The session record (`src/state.mjs`, `src/redis-state.mjs`) is a JSON snapshot, so
coaching state is a new field on the `lesson-studio` session:

```json
{
  "workflow": "lesson-studio",
  "attempts": 3,
  "coaching": {
    "lessonHash": "sha256 of the validated lesson without units and coaching",
    "chapters": {
      "0": {
        "claim": {
          "id": "claim-…",
          "quote": "it will cool at the same rate the whole time",
          "interpretation": "The learner expects the temperature to fall by equal amounts in equal intervals.",
          "assessment": "misconception",
          "confirmed": true,
          "events": [
            { "action": "proposed", "modelCalls": 1 },
            { "action": "confirm", "source": "learner", "modelCalls": 0 }
          ]
        },
        "before": "the gap to room temperature shrinks so the drop per minute shrinks",
        "evidence": [{ "id": "ev-…", "...": "see Evidence records" }],
        "coachTurns": 1,
        "reasoningTurns": 0,
        "posed": null,
        "report": null
      }
    }
  }
}
```

`lessonHash` ties every record to one lesson. A request that carries a lesson with a
different hash starts a fresh `coaching` block: a creator who edits the draft mid-session
loses the old evidence and claim, which is right, because they belong to a lesson that no
longer exists. The hash excludes `units` and `coaching` so that switching display units or
turning an operation on does not reset the session.

### `confirm-claim` at Predict

Mirrors `propose_claim` followed by the local confirmation in `/api/claim`.

**Request** `POST /api/studio/claim`

```json
{
  "sessionId": "…",
  "lesson": { "...": "the full lesson, validated server-side" },
  "chapter": 0,
  "language": "en",
  "prediction": "disagree",
  "statement": "I think it cools at the same rate the whole time, a fixed number of degrees per minute."
}
```

**Code checks before the call**

- `validateLesson` passes and `lesson.coaching.predict.op === "confirm-claim"`, with this
  chapter in the operation's `chapters` list when one is given. Otherwise 400 "This lesson
  does not declare a coached Predict stage."
- `prediction` is one of `agree`, `disagree`, `unsure`; `statement` is 1–400 characters.
- No claim for this chapter is waiting for confirmation (409, like the bench's `confirm`
  phase, which refuses turns until the learner decides).
- Session attempts below eight and an hourly turn available; the attempt is counted before
  the call, as every Studio request is.

**What Muse receives.** Only what the learner can see before the result: the authored
claim, framing and assumptions, the inputs with labels, units and ranges, the output
labels and units (or the stage titles for a process), the learner's prediction and their
statement. A new `predictView(chapter, language)` in `src/lesson-tester.mjs` builds it; it
is narrower than `learnerView`, which includes observed values and is right for the test
learner but not here. Samples, metrics, the authored explanation and the transfer are
never in this request.

The instructions are the bench's claim-phase rules in short form: capture, do not correct;
preserve negation and uncertainty; a clearly stated false claim is still a claim; a bare
number or a help request is ambiguous. The tool `restate_claim` has exactly these fields:

| Field | Limit | Checked by code after the call |
| --- | --- | --- |
| `interpretation` | 1–400 characters | length |
| `evidence` | 1–400 | must be an exact substring of `statement` (the bench's `current-quote` rule) |
| `assessment` | `supported`, `misconception`, `ambiguous` | enum; `ambiguous` returns the question only and stores no claim |
| `question` | 1–200 | length; must ask whether the restatement matches, never whether the learner agrees with a correction |

The reply also passes a leak guard: neither text may contain the chapter's final metric
values or the transfer answer as `formatDemoNumber` would print them. This is a string
check, not a semantic one, and the document says so wherever it is mentioned.

**What the learner sees.** The interpretation, the question, and two local buttons. The
`assessment` is stored but not shown at Predict: showing "misconception" before the
experiment would give the outcome away. It appears in the transfer report later as
"Muse read your first claim as …", labelled as the model's reading.

**Confirm** `POST /api/studio/confirm` with `{sessionId, chapter, claimId, decision}` where
`decision` is `confirm` or `revise`. No model call, no attempt, no hourly turn, like
`/api/claim`. `confirm` marks the claim confirmed; `revise` archives it and the learner may
rewrite the statement and ask again, which is a new attempt. The events list is the audit
trail the bench shows under "Claim decisions".

### `coach` at Explain

This is the existing guide route with a learner explanation, made stricter when the lesson
declares it. The undeclared route keeps working exactly as today for every lesson, so
"Check my explanation with Muse" on a gallery lesson is unchanged.

**Request** is today's guide body (`lesson`, `chapter`, `variant`, `prediction`, `language`,
`controls`, `metric`, `explanation`). Nothing new for the browser to send.

**Code before the call**

- Today's checks (`lessonAuthorRequest(body, 'guide')`): the lesson validates, the chapter
  exists, `controls` are on the reviewed grid (`chapterExperiment` throws otherwise),
  `explanation` is 1–700 characters.
- The lesson declares `coaching.explain.op === "coach"`; otherwise the request runs the
  unchanged guide path.
- An evidence record is minted for this chapter at these settings (next subsection) before
  the call, so the model can cite an id that exists.

**What Muse receives.** Today's input (`authoredContext`, `prediction`,
`learnerExplanation`, `checked`, `priorityNote`) plus `confirmedClaim` (the interpretation,
when one was confirmed) and `evidenceRecords`: the ids with their metrics and samples. The
instructions add the bench's grounding rules: quote the learner's current words exactly;
cite only offered evidence ids; the follow-up must not reveal the transfer answer. The tool
is `guide_lesson` with two added fields:

| Field | Limit | Checked by code after the call |
| --- | --- | --- |
| `verdict` | `supported`, `partly`, `unsupported` | enum (as today) |
| `explanation` | ≤ 700 | length (as today); leak guard against the transfer answer |
| `followUp` | ≤ 200 | length (as today); leak guard |
| `nextAction` | `replay`, `compare`, `transfer` | enum (as today) |
| `evidence` (new) | 1–300 | exact substring of the learner's explanation |
| `evidenceIds` (new) | 1–3 ids | each issued for this chapter and this `lessonHash`; each replays cleanly |

The first accepted explanation in a chapter is stored as `before`, the way the bench stores
the original explanation for `compare_reasoning`. `coachTurns` is incremented.

**What the learner sees.** Today's verdict, explanation, follow-up and next-action button,
plus the quoted phrase marked in their own text and an evidence card with the record's
inputs, metrics and a "Replay check · 0 model requests" button, like the bench's
`EvidenceWorkbench`.

### Evidence records and replay

A record is what `facts()` in `src/lesson-author.mjs` already sends to the model, frozen
and signed by context, so that anyone can ask the server to compute it again:

```json
{
  "version": 1,
  "id": "ev-…",
  "sessionId": "…",
  "lessonHash": "…",
  "chapter": 0,
  "variant": 0,
  "controls": { "rate": 0.1 },
  "metric": 0,
  "method": "generated-model-v1",
  "inputs": [{ "id": "rate", "value": 0.1, "unit": "1/min" }],
  "formulas": [{ "id": "temp", "expression": "ambient+(initial-ambient)*exp(-rate*x)", "unit": "°C" }],
  "metrics": [{ "label": "Temperature", "value": 22.2, "unit": "°C" }],
  "samples": [{ "progress": 0, "values": [80] }, { "progress": 0.25, "values": [40.3] }],
  "limitations": { "en": "Only the authored formulas are recomputed…", "zh": "…" }
}
```

`method` is `generated-model-v1`, `generated-process-v1` or `catalog-v1` (catalog chapters
replay through `lessonExperiment`). A record never contains the transfer answer: by the
Explain stage the learner has seen the result but not the transfer, and records are
returned to the browser. At most six records per chapter are kept; a seventh request at
new settings drops the oldest.

**Replay** `POST /api/studio/replay` with `{sessionId, lesson, evidenceId}`: the server
recomputes the record from the lesson it was sent and the stored context and compares with
`isDeepStrictEqual`, as `replayEvidence` in `src/evidence.mjs` does. A lesson whose hash
differs, a tampered record or an unknown id all return 404 "Evidence not found or failed
integrity checks." The reply is `{id, verified: true, method, modelCalls: 0}`. Replay costs
no attempt and no hourly turn.

### `check-reasoning` at Transfer

Mirrors `compare_reasoning`: offered only once code has marked the answer right, grounded
in an exact quote of the current words and the exact first explanation, and finished by a
report whose outcome code decides.

**Request** `POST /api/studio/reasoning`

```json
{
  "sessionId": "…",
  "lesson": { "...": "" },
  "chapter": 0,
  "variant": 0,
  "controls": {},
  "metric": 0,
  "language": "en",
  "answer": "19.4",
  "explanation": "The gap to room temperature halves about every 14 minutes, so after 10 minutes it is still above 15 plus half the gap."
}
```

**Code before the call**

- Declared `coaching.transfer.op === "check-reasoning"`.
- The server recomputes the chapter's transfer (`chapterExperiment(...).transfer`) and marks
  `answer` with the same tolerance the player uses. A wrong answer returns 200
  `{checked: {correct: false}}` and makes **no model call**: the player has already said
  "that does not match yet", and reasoning about a wrong number is not what the budget is
  for. This is stricter than the bench, which allows clarification turns during transfer.
- `explanation` is 1–700 characters.

**What Muse receives.** The authored context, the checked facts, the transfer case and its
answer (allowed now, the learner has it), the learner's explanation, `originalExplanation`
(`before`, when the learner was coached at Explain) and the confirmed claim. The tool
`assess_transfer`:

| Field | Limit | Checked by code after the call |
| --- | --- | --- |
| `verdict` | `supported`, `partly`, `unsupported` | enum |
| `evidence` | 1–300 | exact substring of the current explanation |
| `priorEvidence` | present only when `before` exists | must equal `before` exactly; the schema offers it as a single-value enum, as the bench does |
| `feedback` | ≤ 600 | length |
| `question` | ≤ 240 | length; one open question, never a second numeric task |
| `evidenceIds` | 1–3 | issued, replayable |

**The report** is built by code from the session, in the shape of the bench's
`TransferReport`:

```json
{
  "outcome": "independent",
  "checkedAnswer": { "value": 19.4, "expected": 19.37, "tolerance": 0.097, "unit": "°C" },
  "reasoningAssessment": "model-supported",
  "originalQuote": "the gap to room temperature shrinks so the drop per minute shrinks",
  "transferQuote": "The gap to room temperature halves about every 14 minutes",
  "initialClaim": { "interpretation": "…", "assessment": "misconception" },
  "coachTurns": 1,
  "evidenceIds": ["ev-…"],
  "limitation": {
    "en": "The entered value and the authored formulas are checked by code. Reasoning quality is assessed by the selected model and can be wrong. This is one transfer attempt, not proof of lasting mastery.",
    "zh": "…"
  }
}
```

`outcome` is `assisted` when an earlier `check-reasoning` turn on this chapter had already
asked a question, or when a posed case (below) was used in place of the authored transfer;
otherwise `independent`. Coaching at Explain does not make the transfer assisted, which
follows the bench, where revision-phase coaching does not set `scaffolded`. The
`coachTurns` count is in the report anyway, so a reader can judge. The learner's own words
are the two quotes; nothing in the report is a model sentence except the verdict label.

### `next-question` at Complete

Two forms, chosen by the chapter kind, because only one of them can be marked by code.

**Model chapter: a fresh case.** Muse chooses new input values and an axis point and words
the question; code validates the case against the demo and computes the answer. The
contract already defines what a valid transfer case is (`validateDemo` in
`public/demo-model.mjs`: every input on its grid, `at` inside the axis, `output` an
existing id, at least one value changed from the defaults), so the check is
`validateDemo({...demo, transfer: posed})` plus two rules: the case differs from the
authored transfer and from the learner's current controls.

Tool `pose_case`: `question` (bilingual, ≤ 200 each, names the output quantity, no numbers,
no unit, like the author contract), `values`, `at`, `output`, and `why` (≤ 200, one
sentence on what the case tests, shown to the learner). The reply to the browser carries
the case only; the engine computes the answer from the lesson's formulas as it does for
the authored transfer, so the model never sees the answer and the server never sends it.

The engine gains one method, `pose(case)`: it validates the case the same way, stores it
in `state.posed`, returns the stage to `transfer` with `transfer: null`, and `experiment()`
builds the chapter with the posed transfer in place of the authored one. `restart`,
`variant`, `input` and moving to the next chapter clear it. One posed case per chapter per
session.

**Catalog or process chapter: an open question.** The quantum bench's `nextQuestion` is
this: one question Muse asks about the checked result, which nobody marks. The tool
`ask_next` returns `question` (≤ 300) and the reply is shown under "A question to keep
thinking about", labelled as not marked. Nothing enters the engine. The leak guard applies:
the question must not contain the next chapter's transfer answer.

Both forms are one attempt. Studio may later offer a creator "Add this case to the lesson
as the transfer question", which would write it into the contract through the normal
validator; that is a follow-up, not part of this design.

## 2. The contract change

### Fields

One optional top-level field, `coaching`, next to the optional `units`:

```json
{
  "version": 2,
  "units": "metric",
  "coaching": {
    "version": 1,
    "predict": { "op": "confirm-claim" },
    "explain": { "op": "coach" },
    "transfer": { "op": "check-reasoning" },
    "complete": { "op": "next-question" }
  },
  "title": { "en": "Newton cooling: how hot objects cool", "zh": "牛顿冷却：热物体如何降温" },
  "intro": { "...": "" },
  "chapters": [{ "...": "unchanged" }]
}
```

Each stage key is optional. A stage entry has `op` and may have `chapters`, a list of
distinct zero-based chapter indexes the operation is limited to; absent means every
chapter. A three-chapter catalog lesson coached only on its first chapter:

```json
{
  "version": 1,
  "coaching": {
    "version": 1,
    "predict": { "op": "confirm-claim", "chapters": [0] },
    "explain": { "op": "coach", "chapters": [0] },
    "transfer": { "op": "check-reasoning", "chapters": [0] }
  },
  "title": { "en": "Acceleration, roll and landing", "zh": "加速度、翻滚与着陆" },
  "intro": { "...": "" },
  "chapters": [
    { "experiment": "acceleration", "framing": { "...": "" }, "explanation": { "...": "" } },
    { "experiment": "roll", "framing": { "...": "" }, "explanation": { "...": "" } },
    { "experiment": "landing", "framing": { "...": "" }, "explanation": { "...": "" } }
  ]
}
```

Rejected during design: a free-text creator note per operation ("focus on units"). It
would be creator instructions to the model that the learner cannot see, and it would turn a
contract field into a prompt-injection surface that the validator cannot bound. The server
already treats lesson prose as untrusted subject matter; adding text that is meant as
instructions would undo that distinction. If a steering control is wanted later, it should
be an enum.

### Validator rules (`validateLesson` in `public/lesson-schema.mjs`)

| Rule | Behaviour |
| --- | --- |
| Top-level keys | `shape` accepts the four required keys plus any subset of `units` and `coaching`; today it accepts exactly `units` or nothing |
| `coaching` absent | The lesson is unchanged. Every lesson in `public/gallery-lessons.mjs` and `public/evaluation-lessons.mjs` has no `coaching`, so `validateLesson` returns exactly what it returns today; `test/gallery.test.mjs` and `test/evaluation-showcase.test.mjs` keep passing without edits |
| `coaching` present | Exact keys: `version` (must be `1`) plus any subset of `predict`, `explain`, `transfer`, `complete`; at least one stage |
| Stage entry | Exact keys `op` and optionally `chapters`; `op` must be the one operation that stage allows (`confirm-claim`, `coach`, `check-reasoning`, `next-question`) |
| `chapters` | Non-empty array of distinct integers in `[0, chapters.length)` |
| Output | The validated lesson copies `coaching` through, normalised (stage entries in fixed order, `chapters` sorted), the way `units` is copied today |
| Size | The existing byte caps (12 000 for version 1, 24 000 for version 2) are unchanged; a full `coaching` block is under 200 bytes |
| Author schemas | `lessonSchema` and `generatedLessonSchema`, the strict tool schemas sent to the model, do not gain the field. Muse cannot write `coaching`; only Studio (or an imported file) can. This keeps the rule that the creator, not the model, decides where the model is invoked |

Messages name the field and limit, as the validator's other messages do, for example
"coaching.predict.op must be confirm-claim" and "coaching.chapters needs distinct chapter
indexes below 3".

### Where the field travels

- `frontend/lib/types.ts`: `Lesson.coaching?: Coaching`, with `Coaching` and `CoachedStage`
  types; `PlayerState.posed?` for the engine.
- Saving (`buildSavedLesson` in `src/lessons.mjs`) runs `validateLesson`, so the field is
  kept with saved and shared lessons; `lessonSummary` adds `coached: boolean` so shelf and
  shared cards can show a badge without the full lesson.
- Export and import JSON round-trip it, because both go through `validateLesson`.
- The show writer (`showRequest`) and the test learner (`learnerTryoutRequest`) receive
  the lesson through their own projections and ignore the field.
- Cache keys: `withoutUnits` in `frontend/lib/units.ts` becomes `withoutViewerFields`,
  stripping both `units` and `coaching`, so turning coaching on stales no cached tryout,
  show or revision, and a Muse revision keeps the field the way it keeps `units`
  (`Studio.tsx` restores `before.units` onto the revised lesson).
- `frontend/lib/lesson-diff.ts` shows a one-line "Coaching: Predict, Explain" change when a
  revision or edit alters it.

## 3. Player and Studio changes, in outline

### The player

The engine stays a pure state machine. Everything coached lives in the component and the
session: the engine gains only `pose(case)` and `state.posed`.

`LessonPlayer` takes the coaching props it needs instead of one `onGuide`:

```ts
coaching?: {
  declared: Coaching | null;                 // from player.lesson.coaching
  lock: null | "signed-out" | "budget" | "unconfigured" | "session-cap";
  onRequestAccess?: () => void;              // opens the access panel (App already passes it to Studio)
  claim: ChapterClaim | null;                // interpretation, confirmed, question
  onClaim: (statement: string) => void;      // POST /api/studio/claim
  onConfirm: (decision: "confirm" | "revise") => void;
  onGuide: (explanation?: string) => void;   // unchanged; the server decides whether it is the coach op
  evidence: EvidenceRecord[];
  onReplay: (id: string) => Promise<{ verified: boolean }>;
  onReasoning: (answer: string, explanation: string) => void;
  report: TransferReport | null;
  onNext: () => void;                        // POST /api/studio/next
  posed: PosedCase | OpenQuestion | null;
}
```

Per stage, when the lesson declares an operation for the current chapter:

- **Predict.** Under the three prediction buttons, "Say what you expect and why" (textarea,
  400 characters) and "Ask Muse to restate my claim". The reply shows the interpretation and
  question with **This is what I meant** and **Revise** buttons. The Next button is
  unchanged: a prediction alone still opens the experiment.
- **Explain.** Today's explain-back block. When coached, the reply adds the quoted phrase
  marked inside the learner's text and the evidence card with the replay button and
  status line ("Replayed · 0 model requests · verified").
- **Transfer.** After the local check says "That matches this model", a textarea "How did
  you get it?" and "Check my reasoning with Muse". The reply shows the verdict, feedback,
  question, and the transfer report in the bench's four lines (outcome, values checked by
  code, model assessed the reasoning, limitation). The learner can answer the question and
  ask again; that second turn makes the outcome assisted, and the button says so.
- **Complete.** "Ask Muse for a fresh case" (model chapter) or "Ask Muse one more question"
  (other chapters). A posed case returns the player to the Transfer stage with the new
  question and "Fresh case from Muse · answer checked by code" in the eyebrow; an open
  question is shown under the completion text, labelled not marked.

The chapter overview at Complete lists the audit trail: claim proposed, confirmed (local),
coach turns, reasoning turns, evidence replays, each with its model-call count, as the
bench's "Claim decisions" list does.

### The inline locked state

The bench shows a whole-page lock (`.bench-locked` in `frontend/App.tsx`) because every
stage of a bench needs Muse. A coached lesson locks only the operation, inline, at its
stage, and the rest of the stage stays usable:

```
┌ Coached stage · preview access ───────────────────────────┐
│ Muse restates your claim here. The self-checked lesson    │
│ continues without it.                                     │
│ [Enter with access code]                                  │
└───────────────────────────────────────────────────────────┘
```

The eyebrow reuses `App.lockedStageEyebrow`; the sentence is per operation; the button
reuses `Studio.enterWithAccessCode` and calls `onRequestAccess`. The same block, with a
different sentence and no button, covers a signed-in learner whose hourly budget is used
up ("Muse's hourly budget is used up; the lesson continues") or whose session has reached
eight attempts ("This session's eight Muse requests are used; start a fresh session or
continue without"). Today's `canAsk` boolean becomes the `lock` reason so the block can say
why. On phones the block sits in the main column above the Next button, like the bench's
locked stage after the phone layout phase.

### The library

`Entry.depth` in `frontend/components/Gallery.tsx` is `"self"` for every lesson and
`"coached"` for the two benches. It becomes `"coached"` for any lesson whose contract
declares at least one operation, so the Depth filter "Coached by Muse" lists coached
lessons with the benches, the card badge reads "Coached", and the meta line names the
stages ("Coached at Predict, Explain and Transfer"). The provenance note under a coached
gallery lesson adds one sentence: the coached stages need preview access; the lesson plays
without them.

### Studio: attaching operations to a draft

In the review panel (`frontend/components/DraftReview.tsx`), under **Default units for
viewers**, a fieldset **Coaching by Muse** with four checkboxes, one per stage, each with
its one-line description and its cost ("one request per use"):

- Predict · Muse restates the learner's claim for confirmation
- Explain · Muse reads the explanation, quotes it and cites evidence
- Transfer · after code marks the answer, Muse reads the reasoning and a report is written
- After the chapter · Muse poses a fresh case checked by code (model chapters) or asks one
  open question (other chapters)

For a lesson with more than one chapter, each row has a chapter picker that writes the
`chapters` list. A **Coach every stage** button sets all four. The draft's `coaching` field
is written through `validateLesson`, so the review panel's existing validation message
covers mistakes. **Present** shows the creator the coached stages live, because the
creator is signed in; "Try as a learner" (the Spark tryout) is unchanged and ignores
coaching, since Spark would be coaching Spark.

The remembered draft (`frontend/lib/studio-store.ts`) keeps the field with the lesson.
Saved lessons keep it; the shelf card shows "Coached". Shared lessons open for everyone
with the locked blocks inline, which is the only place a signed-out visitor meets coaching.

### Server and client plumbing

- `src/server.mjs`: five new paths in `actions`; the lesson-carrying ones (`claim`,
  `reasoning`, `next`, `replay`) join the 48 000-byte body limit; `confirm` is small. The
  `mode` switch in the `lesson-studio` branch gains `claim`, `reasoning` and `next` (model
  calls, same consume-then-call order, trace, chain, rejection tagging) and `confirm` and
  `replay` (local, before the attempt check, no `consumeTurn`).
- A new `src/lesson-coach.mjs` holds the request builders and readers for the three new
  tools, the evidence record functions (`mintEvidence`, `replayLessonEvidence`), the leak
  guard and the report builder, so `src/lesson-author.mjs` keeps only the author and guide
  contracts. `reasoningEffortFor` gains `claim`, `reasoning` and `next`, all `minimal`
  like `guide`.
- `frontend/lib/api.ts`: the refresh list after a request adds the three model paths so the
  budget pill updates.
- `frontend/lib/messages.ts`: the new strings, bilingual, under `LessonPlayer.coach*` and
  `DraftReview.coaching*`.
- `docs/architecture.md`: the site-frame row and the Meta models table name the coached
  lesson; the lesson-library doc gets a "Coached stages" section with the route table.

## 4. Budget and honesty rules

### Budget

| Action | Session attempts (cap 8) | Hourly bucket |
| --- | --- | --- |
| `confirm-claim` | 1 per call; a revise-and-retry is a second call | 1 |
| `coach` (declared or not) | 1 | 1 |
| `check-reasoning` with a correct answer | 1 | 1 |
| `check-reasoning` with a wrong answer | 0 (no model call) | 0 |
| `next-question` | 1; at most one per chapter per session | 1 |
| `confirm`, `replay` | 0 | 0 |
| Spoken explain-back (`transcribe`) | 0, as today | 1 |

The eight-attempt session cap is the Studio cap and stays. A one-chapter lesson coached at
every stage fits with room to retry (claim 1, coach 1–2, reasoning 1–2, next 1). A
three-chapter catalog lesson coached everywhere does not fit in one session; the design
accepts that rather than raising the cap, because the cap exists to stop one session
looping, and the hourly bucket is the budget that matters. The player shows "N Muse
requests left in this session" beside the coached controls, greys them out at zero with
the inline block above, and offers **Start a fresh coaching session**, which is the
bench's Reset: a new `sessionId`, a new eight, the same hourly bucket, and the claim,
evidence and report of the old session gone.

Replies are cached the way guide replies are (`guideKey` in `frontend/lib/studio-cache.ts`,
extended with the operation name and, for reasoning, the answer): leaving a stage and
coming back shows the remembered reply without a request, and a changed input marks it
stale so the next click is an explicit "Send changes to Muse".

Every attempt is counted before the call and stays counted when the reply is rejected,
exactly as today; the learner's text is preserved and the error says the reply could not
be validated. A rejected reply never reaches the learner, not even in part.

### Honesty

1. **Numbers.** The engine marks the authored transfer in the browser; the server
   re-marks it before `check-reasoning`; evidence records and posed-case answers are
   computed by `chapterExperiment` and `lessonExperiment` only. No model output is ever
   shown as a checked value. The report's `checkedAnswer` line says "Values checked by
   code"; the verdict line says "The selected model assessed the reasoning; code does not
   verify understanding", the bench's own wording.
2. **Order of disclosure.** At Predict the model receives no result, no explanation and no
   transfer. At Explain it receives the result but not the transfer answer. At Transfer it
   receives the answer only after the learner has it right. A test asserts the model input
   at each stage against this list.
3. **Grounding.** Every model reply must quote the learner's current words exactly and
   cite evidence ids the server issued; `priorEvidence` must equal the stored first
   explanation. These are string checks and they reject the whole reply when they fail.
4. **Leak guard.** Model text at Predict and Explain, and an open question at Complete,
   must not contain the formatted final metrics or transfer answer. It is a substring check
   on `formatDemoNumber` output and catches the obvious case only; the document and the
   limitation line never claim more.
5. **Labels.** Interpretation, verdict, feedback and questions are shown under "Muse's
   reading, not a check". Generated lessons keep their existing note that formulas and
   assumptions are not independently verified; the report's limitation line adds that one
   transfer attempt is not proof of lasting mastery.
6. **Who decides where Muse runs.** The creator, through the contract. The compose
   schemas exclude `coaching`; the server refuses an operation the lesson does not
   declare; the learner can skip every operation.
7. **Untrusted text.** Lesson prose, the learner's statement and explanations, and the
   contract itself are subject matter in every prompt, never instructions, as the author
   and guide prompts already state. There is no creator free text in the contract for the
   coach.
8. **Traces.** Each operation is traced through `createTrace` with configured secrets
   redacted; evidence records appear in the trace as the input they were, with no bytes
   beyond what the model saw.

## 5. The benches in the contract

What the two benches do, and whether the operations above express it.

### Physics & math bench (`claim-testing` sessions)

| Bench step | Expressed by | Gap |
| --- | --- | --- |
| `propose_claim` then local confirm (`/api/claim`) | `confirm-claim` + `confirm` | None for one experiment. The bench also classifies the claim (`kind`, `scope`) and picks the distinguishing experiment among the domain's catalog (`domainExperiments`); a lesson chapter has one experiment, so there is nothing to pick |
| `run_experiment` with a server evidence record | The Experiment stage (engine) plus the record minted at `coach` | The bench's record carries the experiment's `proof` and `conclusion` text written by hand per domain (`src/evidence.mjs`, `src/motion-evidence.mjs`); a lesson record carries numbers and the authored `limitations` only |
| `ask_clarification`, `reveal_graph` in the revision phase | `coach` with verdict `partly` and a follow-up; `nextAction: replay` | The bench can refuse to move on; the lesson never gates |
| `select_transfer` between two hand-verified variants | Not expressed. The authored transfer is one case; `next-question` poses a fresh case for model chapters but it is model-chosen within the formula, not a hand-verified scenario with its own prompt |
| `compare_reasoning` with `priorEvidence`, `evidenceIds`, two numeric fields, the report | `check-reasoning` | One number (or one choice) instead of two labelled fields; the report shape is the same |
| `propose_design` and the design-review phase (suction) | Not expressed. A model-chosen candidate from a catalog and a second code experiment have no contract form |
| Scope-ambiguity rule for the crossing problem | Not expressed; it is a regex specific to one problem |
| Domain instructions (`domainInstructions`): hundreds of words of physics guardrails | Not expressed. A generated lesson's guardrails are its authored assumptions and the general priority note; a catalog chapter gets the catalog facts |
| Scripted demo presets, graph focus (suction `visualFocus`), twelve turns | Not expressed; the lesson keeps eight attempts |

The `vehicle` gallery lesson (acceleration, roll, landing) with all four operations
declared is the closest a coached lesson gets to the physics bench: the same checked
calculations, claim confirmation, a quoted and cited coach, a code-decided transfer
report. It is a rung below the bench, not a replacement, because of the gaps above.

### Quantum bench (`quantum-showcase` sessions)

| Bench step | Expressed by | Gap |
| --- | --- | --- |
| Predict agree, disagree, unsure; run the circuit; measure once; 256 fresh preparations | The lesson player already has all of this for the quantum catalog chapters | None |
| `explain_quantum` with `question: why` | Today's "Ask Muse to explain this result" (guide without an explanation) | The bench's `focus` enum (amplitudes, probabilities, circuit) has no player equivalent |
| `explain_quantum` with `question: claim` | `coach` with the learner's explanation | The bench coaches without a learner text; the lesson's coach needs one. The bench's `nextQuestion` is the lesson's `followUp` |
| `nextQuestion` | `next-question` in its open form | None; both are unmarked by design |
| The circuit editor (lesson, phase, basis, target, presets) | Not expressed; the catalog chapters have two variants each |

The `quantum` gallery lesson with `coach` and `next-question` declared covers most of the
quantum bench's coaching on a fixed circuit.

### What cannot be expressed, in one list

Model-chosen experiments or designs; hand-verified transfer variants with their own
prompts; two-field numeric answers; per-domain proof text and guardrail instructions;
problem-specific ambiguity rules; phases the model can refuse to leave; graph focus;
scripted demo presets; a turn limit other than eight. Each is either a hand-built artefact
with no generic validator, or a gate, and the ladder's third rung is defined by having no
gates.

## 6. Phased implementation plan

Each phase is one pull request, docs updated in the same change, CI green. Server tests use
the `node:test` suites with an injected `modelCall` (`test/lesson-http.test.mjs` is the
model); component tests use Vitest; browser tests use Playwright against the built `dist`.

**Phase 0: contract.** `validateLesson` accepts and normalises `coaching`; `types.ts`;
`withoutViewerFields`; the DraftReview fieldset; `lessonSummary.coached`; the library
depth badge and provenance sentence. No server operation yet; a declared lesson plays as
today. Tests: validator accepts each valid shape and rejects each invalid one (wrong `op`
for a stage, unknown stage, empty `coaching`, out-of-range or duplicate `chapters`,
`version` 2); `validateLesson` returns a deep-equal copy for every gallery and evaluation
lesson; Studio attaches and strips the field around caches and a revision; export then
import round-trips it; Gallery shows the badge and the filter.

**Phase 1: evidence and the coach.** `src/lesson-coach.mjs` with `mintEvidence`,
`replayLessonEvidence`, the leak guard; the guide route's declared path; `/api/studio/replay`;
the evidence card and replay button; the inline locked block with its reasons. Tests:
a declared guide reply without `evidence` or with an unissued id is rejected and the
attempt still counted; a tampered record, a different lesson and an unknown id replay as
404; replay consumes no turn; the model input contains no transfer answer; the leak guard
rejects a follow-up that prints the answer; the player shows the locked block signed out
and the card signed in; `before` is stored once.

**Phase 2: claim.** `/api/studio/claim` and `/api/studio/confirm`; `predictView`; the
Predict stage UI. Tests: the model input has no samples, metrics, explanation or transfer
(an assertion over the keys); a quote that is not in the statement is rejected; an
`ambiguous` reply stores no claim; a pending claim blocks a second proposal with 409;
`confirm` and `revise` cost nothing and write events; a confirmed interpretation reaches
the coach input; the `assessment` is absent from the Predict reply and present in the
report.

**Phase 3: reasoning and the report.** `/api/studio/reasoning`, the report builder, the
Transfer stage UI. Tests: a wrong answer returns `correct: false` with no model call and no
attempt; the server re-marks the answer with the player's tolerance; `priorEvidence` must
equal `before`; the outcome is `independent` on the first correct turn and `assisted` after
a second; the report's quotes are the learner's text; the report renders the four lines.

**Phase 4: next question.** The engine's `pose`; `/api/studio/next` in both forms; the
Complete stage UI. Tests: engine unit tests for `pose` (invalid case throws, stage returns
to transfer, `check` marks against the posed case, `restart` clears it); a posed case equal
to the authored transfer or to the current controls is rejected; a process or catalog
chapter gets the open form and nothing enters the engine; one case per chapter per session.

**Phase 5: persistence and the gallery.** `validateGrades` in `src/lessons.mjs` grows into
a per-chapter coached record (claim, grade, report) so a saved lesson reopens with them, as
grades do today; the `vehicle` and `cooling` gallery lessons declare operations; the
Playwright suite checks that a coached gallery lesson completes signed out with the locked
blocks visible and never calls the server, and that the Depth filter lists it with the
benches. `docs/architecture.md` and `docs/lesson-library.md` describe the finished feature
and this document is retired.

## Uncertainties

- **Stage ownership.** The server does not own the player's stage; it checks the lesson,
  the ranges, the lengths and the order of disclosure, not whether the learner looked at
  the graph. A coached lesson's integrity claims are about numbers and evidence. The bench
  owns its phases and can make the stronger claim; this design does not pretend to.
- **Chaining.** Studio text turns chain through structured output; the bench and quantum
  coach use function tools and never chain. The operations here use structured output on a
  `coach` chain so the follow-up question and the learner's next explanation stay in one
  context; if the chain proves unhelpful it can be dropped without changing any contract.
- **Role.** Spark coaches, as it grades explain-backs today. Wonder would be slower and
  costlier for a reply that is one paragraph long; nothing here prevents a later switch.
- **Chapter granularity.** `chapters` on a stage entry is the smallest change that lets a
  creator focus the budget; a per-chapter `coaching` block would be more expressive and
  more to validate. Start with the list.
- **Assisted versus independent.** Following the bench, coaching at Explain does not make
  the transfer assisted. A reviewer might reasonably want it to; the report shows
  `coachTurns` so the choice can be revisited without changing the schema.
- **The eight-attempt cap on long lessons.** Accepted as a limit with a fresh-session
  button rather than raised; see Budget.
- **Open questions are unmarked.** The quantum bench already does this; the label has to
  carry the weight, and a reviewer may still read a model question as a graded step.
- **Where this document lives.** `docs/repo-guidelines.md` keeps implementation plans out
  of the public repository once work has landed. Until then this design is a how-it-would-
  work document and belongs here; its phase plan and uncertainties should be pruned as
  phases ship.
