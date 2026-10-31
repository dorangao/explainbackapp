# Evaluation card

What ExplainBack has measured about its use of the Muse models, how, and what the numbers do and do not establish. Written in the spirit of a model card or datasheet: fixed inputs, published checksums, every limitation stated. Nothing here is a learning-outcome study or a ranking of Meta's models.

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

1. **Deterministic checks (code).** Contract valid (the reply parses, validates and its formulas compile and stay finite across all ranges); status as expected (ready, or declined); renderer kind as expected (model or process); chapter count within the limit; for specified models, the declared input ids, axis, output and probe values at given settings, including an independently computed transfer answer; for learner-phrased models, at least one output carrying a real unit and, where the suite names a quantity, a unit from that family. A case passes "automated checks" only when every check holds. One attempt per case, sequential, no retries, no repair of a rejected reply.
2. **Rubric judge (a model's opinion).** A separate Muse model scores each ready lesson 0 to 2 on five fixed items: neutral framing, precise quantity names and units, a transfer question that asks for exactly what the renderer checks, bilingual parity, and explicit assumptions without invented sources. The judge never contributes to the automated pass and is reported as a judgment of wording and pedagogy, not of scientific validity.

Every report records the suite checksum, the SHA-256 of the scorer and judge source files, the author prompt version, the model names, the per-request latency and token counts, and the hash of each prompt sent. Failures are kept in the table with their reason category (contract rejected, expectation failed, provider or transport); the raw provider text is never recorded.

Versions at the time of the runs below: author prompt `author-v3`; scorer `studio-score-v2`; judge `studio-judge-v1`; compose requests at reasoning effort `low` with an output budget of 8000 tokens (6000 with an image).

The scorer has since moved to `studio-score-v3`, which only trims output units before comparing them with the expected list; it changes no result below.

## Results

### studio-breadth-v1, October 31, 2026

Both models, same 24 cases, one attempt each, Spark as judge. Full reviewed report: [studio-breadth-v1-2026-10-31.md](evaluation/studio-breadth-v1-2026-10-31.md).

| Model | Contracts valid | Automated checks | Declined correctly | Judge mean (ready lessons) | Mean latency | Tokens in / out (24 cases) |
|---|---|---|---|---|---|---|
| muse-wonder-1.0 | 20 / 24 | 20 / 24 | 2 / 2 | 9.89 / 10 over 18 | 12.0 s | 33,598 / 46,389 |
| muse-spark-1.3 | 21 / 24 | 21 / 24 | 2 / 2 | 9.63 / 10 over 19 | 9.4 s | 61,630 / 53,161 |

What the run shows, in plain terms:

- **Breadth.** Across nine model domains and two processes, in two languages, each model produced a valid, computable, unit-labelled lesson contract on the first attempt for all but three or four cases, and both declined the stock-pick request in both languages with a reason ("no bounded model can reliably forecast a specific company's stock price"). Every topic was covered by at least one model: all 22 teachable cases (11 pairs in two languages) have a passing lesson from one model or the other.
- **Where it failed, it failed closed.** All seven failures are contract rejections by the app's validator, not wrong numbers that slipped through: a formula with a possible division by zero (projectile, Wonder), a process with too few stages (half-life, Wonder), an intro or framing over the length limit in one language (two Chinese cases, Wonder), an invalid output definition (projectile, Spark), a transfer case that did not change an input (carbon dating, Spark), and a claim phrased as a question (vaccine, Spark). None reached a learner.
- **Judge.** 37 ready lessons scored a mean of 9.76 / 10 on the five-item rubric. The issues it raised are specific and checkable: an English unit left inside Chinese text, a symbol named differently in the explanation and the formula, a transfer choice that copies a stage sentence, an intro that hints at the answer. These are the kinds of defects the Studio revision loop is for.
- **Cost.** A Wonder draft took 12 s and about 1,400 input / 1,900 output tokens on average; Spark 9 s and about 2,600 / 2,200. The declined requests took 1.4 to 3.6 s.

### studio-v1, October 31, 2026

Same settings, the 12 specified cases, where the scorer also checks the computed numbers. Full reviewed report: [studio-v1-2026-10-31.md](evaluation/studio-v1-2026-10-31.md).

| Model | Contracts valid | Automated checks (incl. numeric probes) | Declined correctly | Judge mean (ready lessons) | Mean latency | Tokens in / out (12 cases) |
|---|---|---|---|---|---|---|
| muse-wonder-1.0 | 12 / 12 | 12 / 12 | 4 / 4 | 9.88 / 10 over 8 | 9.8 s | 17,360 / 16,705 |
| muse-spark-1.3 | 11 / 12 | 11 / 12 | 4 / 4 | 9.71 / 10 over 7 | 8.9 s | 31,376 / 25,476 |

Here the checks are strict: for the cooling and pendulum lessons the scorer evaluates the model's own formula at four probe settings and compares the transfer answer with an independently computed value. Every ready lesson from both models matched those numbers. The one failure was Spark's English pendulum reply, which the validator rejected for an invalid output definition; no wrong number reached the checks. Both models declined the ambiguous request and the computational-fluid-dynamics request in both languages.

## In the app

Fourteen of the passing breadth lessons are shown in the library under **From the evaluation**, unedited, each with its model, question, judge score and a provenance note; three questions have both models' replies and a side-by-side view (`/#compare:logistic-growth-en`, `rc-charging-zh`, `dns-lookup-zh`) with the judge's scores and issues under each. `scripts/eval-showcase.mjs` builds that fixture from a run's local reports; see [lesson-library.md](lesson-library.md#evaluation-showcase-added-october-31-2026-pacific).

A signed-in creator can also run the same comparison on their own question from Studio (**Compare two models**): both models draft it, the open-question scorer checks each reply and the judge the creator picks (Spark by default, or Wonder) scores the ready lessons, with the result shown side by side. Those runs are not part of the frozen suites and are not recorded here.

## How to reproduce

```sh
npm run eval:studio -- --suite=studio-breadth-v1 --models=meta:muse-wonder-1.0,meta:muse-spark-1.3 --judge=meta:muse-spark-1.3
```

Without `--live` the command prints the case list and sends nothing. With `--live` and a configured `MODEL_API_KEY` it runs every case once per model, writes `report.json` and `report.md` per model and a `comparison.md` under `output/eval/` (ignored by git), and exits non-zero if any automated check failed. `--samples=N` repeats each case to expose run-to-run variance. The same command with `--suite=studio-v1` runs the specified suite.

## What these numbers do not establish

- Not scientific validity. A formula that compiles, stays finite and matches a probe is consistent with the lesson's own assumptions, nothing more. Human review of the science is still required before a lesson is presented, and the app says so on every generated lesson.
- Not learning effectiveness. No learner study has been run.
- Not a ranking of the models. One sample per case, one day, one prompt version. Differences between Wonder and Spark are observations about this pipeline on these cases.
- Not an independent rubric comparison. Spark was the judge in both runs, so it scored its own lessons as well as Wonder's. The deterministic checks are unaffected; the judge means should be read as one model's view of wording, with that bias in mind.
- Not fluency certification. Bilingual parity is a rubric item scored by a model, plus a script check for stray Cyrillic; it is not a human translation review.
- Not independent of the prompt. The author prompt is part of the system under test; a prompt change invalidates comparisons across versions, which is why the version is recorded.

## Standards this follows

- Fixed suites with checksums, several metrics reported side by side, failures shown, in the manner of HELM-style evaluation reporting.
- This card follows the model-card and datasheet practice of stating intended use, what was measured, with what, and the limits.
- The NIST AI Risk Management Framework's "measure" function: record what was tested, how, and what was not.
- Separation of deterministic checks from model judgment: code, not a model, checks every number; the rubric judge scores wording only and is named so a reader can see when it scored its own output.
- The product itself is checked against WCAG 2.1 AA (browser tests) and the NIST SSDF secure-development practices (see `docs/security.md`).
