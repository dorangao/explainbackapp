# Evaluation card

How ExplainBack evaluates generated lesson contracts, what the checks cover, and where human review is still required. This public card documents the frozen inputs and scoring methods; dated run reports and operational measurements belong in the separate private repository. Nothing here is a learning-outcome study or a ranking of Meta's models.

## What is evaluated

The Studio pipeline turns a learner-phrased topic into a bilingual lesson contract: a title, an introduction, one or two chapters, and either an adjustable numerical model (inputs with ranges and units, a time axis, output formulas, a numeric transfer case) or an ordered process with stages and a choice question. The app never executes model-written code; it compiles the declared formulas, checks them for finiteness across every input range, and computes every number itself.

Three frozen suites exist. A suite is a JSON file under `eval/` whose SHA-256 is checked before any case runs; a changed byte stops the run.

| Suite | Cases | What it asks | Checksum (SHA-256) |
|---|---|---|---|
| `studio-v1` | 12 | Six bilingual pairs: two specified models (cooling, pendulum), two processes (web cache, water cycle), one ambiguous request, one request that cannot be modelled responsibly (CFD). Model cases name input ids, ranges and probe values, so the scorer can check the computed numbers. | `e2817e2c4cd6ea4550ca96c455e4a7242d391af25111cdbeed68ddac961683aa` |
| `studio-image-v1` | 2 | A hand-drawn sketch (bytes hashed) becomes a model lesson with a unit-labelled output. | `08d89c800c82059e3c8f114a414a5a7bc8e78f3856d2a376397fc09136a9e7e8` |
| `studio-breadth-v1` | 24 | Twelve bilingual pairs phrased as a learner would ask, not as specifications: nine adjustable models across physics, nuclear chemistry, biology, pharmacology, finance, networking, earth science, road safety and electronics; two ordered processes (immunology, and a DNS lookup, so networking appears once as a model and once as a process); one request that should be declined (a stock pick with buy advice). | `d297c2235e8ff567a5589a8c78392a22fa459fbc16cd70c96956cd3614710c43` |

## How a case is scored

Two layers, kept apart on purpose.

1. **Deterministic checks (code).** Contract valid (the reply parses, validates and its formulas compile and stay finite across all ranges); status as expected (ready, or declined); renderer kind as expected (model or process); chapter count within the limit; for specified models, the declared input ids, axis, output and probe values at given settings, including an independently computed transfer answer; for learner-phrased models, at least one output carrying a non-dimensionless unit label and, where the suite names a quantity, a unit from that family. A case passes "automated checks" only when every check holds. One attempt per case, sequential, no retries, no repair of a rejected reply.
2. **Rubric judge (a model's opinion).** A Muse rubric judge scores each ready lesson 0 to 2 on five fixed items: neutral framing, precise quantity names and units, a transfer question that asks for exactly what the renderer checks, bilingual parity, and explicit assumptions without invented sources. The judge never contributes to the automated pass and is reported as a judgment of wording and pedagogy, not of scientific validity.

Every report records the suite checksum, the SHA-256 of the scorer and judge source files, the author prompt version, the model names, the per-request latency and token counts, and the hash of each prompt sent. Failures are kept in the table with their reason category (contract rejected, expectation failed, provider or transport); the raw provider text is never recorded.

## In the app

Fourteen of the passing breadth lessons are shown in the library under **From the evaluation**, unedited, each with its model, question, judge score and a provenance note; three questions have both models' replies and a side-by-side view (`/#compare:logistic-growth-en`, `rc-charging-zh`, `dns-lookup-zh`) with the judge's scores and issues under each. `scripts/eval-showcase.mjs` builds that fixture from a run's local reports; see [lesson-library.md](lesson-library.md#evaluation-showcase-added-october-31-2026-pacific).

A signed-in creator can also run the same comparison on their own question from Studio (**Compare two models**): both models draft it, the open-question scorer checks each reply and the judge the creator picks (Spark by default, or Wonder) scores the ready lessons, with the result shown side by side. Those runs are not part of the frozen suites and are not recorded here.

The showcase cards carry cover illustrations drawn by Muse Image from each lesson's title and introduction (`scripts/lesson-covers.mjs`); they are decorative, were not reviewed, and play no part in the evaluation.

This card itself is a page of the app (`/#evaluation`, linked from every showcase lesson, comparison and the footer), rendered from this file when the app is built, so the two cannot drift. Dated per-case reports are kept privately rather than linked from the public app.

## How to reproduce

```sh
npm run eval:studio -- --suite=studio-breadth-v1 --models=meta:muse-wonder-1.0,meta:muse-spark-1.3 --judge=meta:muse-spark-1.3
```

Without `--live` the command prints the case list and sends nothing. With `--live` and a configured `MODEL_API_KEY` it runs every case once per model, writes `report.json` and `report.md` per model and a `comparison.md` under `output/eval/` (ignored by git), and exits non-zero if any automated check failed. `--samples=N` repeats each case to expose run-to-run variance. The same command with `--suite=studio-v1` runs the specified suite.

## What these checks do not establish

- Not scientific validity. A formula that compiles, stays finite and matches a probe is consistent with the lesson's own assumptions, nothing more. Human review of the science is still required before a lesson is presented, and the app says so on every generated lesson.
- Not learning effectiveness. No learner study has been run.
- Not a ranking of the models. A sample is an observation about this pipeline, its selected cases and its prompt version. It is not a general comparison of the models.
- Not an independent rubric comparison. The chosen judge can also be one of the author models, including when it scores its own draft. Deterministic checks stay separate; rubric scores are one model's view of wording, with that bias in mind.
- Not fluency certification. Bilingual parity is a rubric item scored by a model, plus a script check for stray Cyrillic; it is not a human translation review.
- Not independent of the prompt. The author prompt is part of the system under test; a prompt change invalidates comparisons across versions, which is why the version is recorded.

## Standards this follows

- Fixed suites with checksums, several metrics reported side by side, failures shown, in the manner of HELM-style evaluation reporting.
- This card follows the model-card and datasheet practice of stating intended use, what was measured, with what, and the limits.
- The NIST AI Risk Management Framework's "measure" function: record what was tested, how, and what was not.
- Separation of deterministic checks from model judgment: code validates the contract and computes its numbers; independent numeric probes exist only for specified cases, and the rubric judge scores wording and is named so a reader can see when it scored its own output.
- The product itself is checked against WCAG 2.1 AA (browser tests) and the NIST SSDF secure-development practices (see `docs/security.md`).
