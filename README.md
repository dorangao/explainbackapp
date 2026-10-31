# ExplainBack / 讲给我听

ExplainBack turns a question or sketch into a bilingual, reviewable interactive lesson. A learner predicts, operates an experiment, explains the result, and tries a fresh case. Muse can help draft and revise the lesson; application code validates the lesson contract and calculates its outputs.

ExplainBack 把问题或草图变成可审阅的中英双语互动课程。学习者先预测，再操作实验、解释结果，并尝试新的情境。

ExplainBack builds on an earlier ExplainBack project by the same author. This repository is the standalone extract prepared for the event: the application as it stands, with its tests and documentation, and without the earlier project's history. [explainback.app](https://explainback.app/) is deployed from it. What goes in this public repository and what stays private is set out in [docs/repo-guidelines.md](docs/repo-guidelines.md). What existed before the event is stated in [Pre-existing work](#pre-existing-work) below.

## What to look at

Each claim below names where to see it in the app and the check in this repository that backs it. Nothing here establishes scientific or teaching correctness; that still needs human review.

| Claim | Where to see it | What backs it |
|---|---|---|
| The model writes a lesson contract, never code. The app compiles and range-checks every formula before anything runs, and rejects malformed contracts instead of repairing them. | Create a lesson, or run step 1 of the reviewer tour; review the assumptions and definition before presenting. | `test/lesson-structured.test.mjs`, `test/formula-plot.test.mjs`, `test/lesson-http.test.mjs` (generated code is refused) |
| A learner's answer is marked by code, not by the model. The explain-back grade is made against the checked result, and a wrong explanation is told so with one follow-up question. | Run the test learner (tour step 2); then on a lesson, disagree with the claim, test it, and explain the result wrongly. | `test/lesson-tester.test.mjs`, `test/lesson-http.test.mjs` (guide), `e2e/judge-path.spec.ts` |
| The learner's feedback goes back to the author in the same conversation, and every changed field is shown old against new. | *Use these suggestions in a revision*, then *What Muse changed*; the request summary says *chained*. | `test/lesson-http.test.mjs` (chaining), `frontend/components/Studio.test.tsx` (what a revision changed) |
| A hand-drawn sketch becomes a lesson. SAM 3.1 locates what the creator names on the sketch; it does not read or judge the lesson. | Attach a sketch on Create and *Find with SAM 3.1*; library card 06 came from one. | `test/meta.test.mjs` (SAM), `test/lesson-structured.test.mjs` (image attachment) |
| The writer flags which slides deserve a picture; Muse Image draws only those, inside the request budget. The browser narrates in English or Chinese. | *Make a narrated show* (tour step 3), then *Illustrate one slide* (step 4); switch EN / 中 on the show. | `test/lesson-show.test.mjs`, `e2e/app.spec.ts` |
| Every request reports its cost: model, time, tokens, cache hits and reasoning effort, with the model's own account of itself labelled unverified. | The request summary under any Studio result; the tour foot shows requests used and remaining. | `test/reasoning-effort.test.mjs`, `test/lesson-http.test.mjs` (metrics) |
| The hosted app is checkable: a health route reports the deployed build, security headers are tested against the hosting config, and each build on `main` carries a signed provenance attestation. | `https://explainback.app/api/health`; [docs/security.md](docs/security.md); the *Build provenance attestation* job on a `main` run. | `test/operations.test.mjs`, `.github/workflows/verify.yml`, `e2e/accessibility.spec.ts` |

## Experience

- Signed-in creators can **Compare two models**: one question drafted by Muse Wonder and Muse Spark at once, both replies checked by the app and scored by the rubric judge the creator picks (Spark or Wonder), side by side, with a button to carry the preferred draft into review.
- Browse **From the evaluation** in the library: fourteen unedited lessons the Muse models drafted during the frozen breadth evaluation, with their judge scores, and three questions where both models' replies sit side by side. The [evaluation card](docs/evaluation.md) is also a page of the app (`/#evaluation`), rendered from that file at build time, and **About** (`/#about`) explains how a lesson is checked, what has been measured, the limits and where the source lives.
- Open a reviewed gallery lesson or narrated show without signing in. Gallery playback uses included lesson data and generated cover assets and does not make a model request.
- In Lesson Studio, request a new lesson or revision, review its assumptions and definition, and explicitly present it. Structured, bounded lesson data is interpreted by the app; generated JavaScript is not executed.
- Where configured, Muse can draft and revise lessons, try them as a learner, evaluate an explanation, write a show script, generate its cover and slide illustrations, or transcribe spoken explanations; SAM 3.1 can find the object a creator names in their sketch. Voice playback for shows uses the browser's speech synthesis. See the model table in [docs/architecture.md](docs/architecture.md).
- Signed-in reviewers get a six-step tour on the Create page (draft, learner tryout, narrated show, one illustration, save, share) that reuses cached results and states what each step costs.
- Signed-in creators keep the lessons they make on a personal shelf, update them in place, and share any one by link; shared lessons open without sign-in and appear in the library under *Shared by creators*. The library has search and kind filters. With Vercel Blob configured, show covers, slide illustrations drawn on request by Muse Image, and the sketch a lesson came from are kept with saved lessons. See [docs/lesson-library.md](docs/lesson-library.md) and, for what happens when a budget or model is missing, [docs/error-states.md](docs/error-states.md).
- English and Chinese are available. Model output and a working numeric calculation do not establish scientific correctness or teaching effectiveness; lessons require human review.

## Local setup

Use **Node 22** and npm. From this directory:

```sh
npm ci --ignore-scripts
npm run build
npm start
```

Open `http://127.0.0.1:4173` for the production build. The gallery is available without a model key. To run with Vite development tooling, use `npm run dev` instead of the build and start commands. `npm run dev:open` enables sign-in-free local development; hosted cloud handling explicitly disables that mode.

For live lesson creation, copy `.env.example` to `.env.local`, keep that file private, and configure `MODEL_API_KEY` and the tester credentials or reviewer access codes described in the example. The default provider is Meta; optional Ollama configuration is for local use. Model calls are explicit actions and can incur usage charges. Do not include credentials or actual access codes in source or submissions.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run test:unit
npm run build
npx playwright install chromium  # once, for browser tests
npm run test:browser
```

The browser tests use a synthetic local provider fixture and include an automated WCAG audit (`e2e/accessibility.spec.ts`). What has been measured about the Muse-backed pipeline itself, on frozen suites with checksums and a separate rubric judge, is in the [evaluation card](docs/evaluation.md). Some HTTP and browser tests need localhost socket access. CI also runs `npm run scan:secrets` and `npm run audit:prod`; see [security notes and standards alignment](docs/security.md). Test results describe the checked revision and do not establish scientific or teaching correctness.

## Architecture and hosting

See the maintained [architecture diagram and technology stack](docs/architecture.md). Update that document with changes to system components, integrations, model roles, storage or deployment.

Operating the hosted app (health route, request log, common situations, rollback) is described in the [operations runbook](docs/operations.md). The cloud entry point is `api/index.js`. It requires shared Redis configuration and an explicitly allowed HTTPS origin, uses the hosted Meta provider, and does not honor local open-access mode. Configure secrets only as server-side environment variables. Adding a static asset to `public/` also requires checking local serving and production copying in `src/static.mjs` and `scripts/build-vercel.mjs`.

## Pre-existing work

The hackathon kickoff was October 26, 2026, 12:24 PM Eastern (9:24 AM Pacific). Before it, the author had set up a Muse API key and run two small connection probes; those probe scripts are not in this repository. The author's recollection is that the application itself was started after kickoff.

The evidence does not fully agree with that recollection, and the organizers have been asked to rule on it. A snapshot of the original project taken on the afternoon of October 26 holds an 18-file prototype whose file modification times fall before 9:24 AM Pacific for 17 of the files: a first HTTP server, a Meta Responses adapter, a learning engine for three asymptote problems, a problem catalog, a vanilla-JS page with its stylesheet and graph and formula helpers, three test files and a smoke script. Modification times can be wrong, and the original repository's first commit is from 9:46 PM Pacific that day, but the timestamps are what the record shows.

Following the organizers' guidance to rewrite rather than copy, that prototype's code has been replaced in this repository in two rounds:

- October 28: the HTTP layer was moved to Express, the graph and formula helpers were replaced by a D3 plot and a bounded expression catalog, and the model transport was moved to the OpenAI-compatible SDK against Meta's endpoint. The old page, graph and formula files and the probe scripts were left out.
- October 30 to 31: the remaining prototype code was rewritten from its behaviour and the current tests, with new structure and wording: the asymptote coach (`src/learning.mjs`), the problem catalog (`src/problems.mjs`), the live smoke script (`scripts/evaluate.mjs`), the pre-kickoff tests in `test/learning.test.mjs`, `test/meta.test.mjs` and `test/server.test.mjs`, the lines the server and Meta adapter still shared with the prototype, and the base block of `public/style.css`, which still carried the prototype's 116 CSS rules verbatim.

Check used: every file in this repository was compared line by line (whitespace-normalised, lines of 20 characters or more) and, for stylesheets, rule by rule, against the prototype snapshot. After the rewrite 32 of 16,218 lines are identical, all of them exported names, `case` labels, function signatures or one-line idioms such as `process.exitCode = 1;`; no CSS rule is identical. Module paths, export names, HTTP routes and the browser-facing data shapes were kept so the event-built code around them did not change. Everything else in this repository, including the React frontend, Lesson Studio, the claim-testing labs, the library, the show pipeline and the hosting code, was written during the event.

The dated snapshot, its manifest and the comparison script are kept privately with the provenance record and will be provided on request. None of this is an eligibility ruling; that is the organizers' to make.

## Source and assets

Application source is licensed under [MIT](LICENSE); third-party packages retain their own licenses. The seven gallery show covers and their slide illustrations were generated with Muse Image (narration by Muse Wonder; six regenerated October 29, 2026, the ExplainBack lesson's made October 30), and the sketch-pendulum lesson uses a hand-drawn sketch according to the source project. The lesson *How ExplainBack makes a lesson* is hand-authored and describes this repository's own pipeline. The repository includes synthetic test fixtures and excludes local environment files and generated evaluation output. The author keeps the detailed provenance record privately and will provide it on request.
