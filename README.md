# ExplainBack / 讲给我听

ExplainBack turns a question or sketch into a bilingual, reviewable interactive lesson. A learner predicts, operates an experiment, explains the result, and tries a fresh case. Muse can help draft and revise the lesson; application code validates the lesson contract and calculates its outputs.

ExplainBack 把问题或草图变成可审阅的中英双语互动课程。学习者先预测，再操作实验、解释结果，并尝试新的情境。

ExplainBack builds on an earlier ExplainBack project by the same author. This repository is the standalone extract prepared for the event: the application as it stands, with its tests and documentation, and without the earlier project's history. [explainback.app](https://explainback.app/) is deployed from it. What goes in this public repository and what stays in local notes is set out in [docs/repo-guidelines.md](docs/repo-guidelines.md).

## Experience

- Open a reviewed gallery lesson or narrated show without signing in. Gallery playback uses included lesson data and generated cover assets and does not make a model request.
- In Lesson Studio, request a new lesson or revision, review its assumptions and definition, and explicitly present it. Structured, bounded lesson data is interpreted by the app; generated JavaScript is not executed.
- Where configured, Muse can draft and revise lessons, try them as a learner, evaluate an explanation, write a show script, generate its cover and slide illustrations, or transcribe spoken explanations; SAM 3.1 can find the object a creator names in their sketch. Voice playback for shows uses the browser's speech synthesis. See the model table in [docs/architecture.md](docs/architecture.md).
- Signed-in creators keep the lessons they make on a personal shelf, update them in place, and share any one by link; shared lessons open without sign-in and appear in the library under *Shared by creators*. The library has search and kind filters. With Vercel Blob configured, show covers, slide illustrations drawn on request by Muse Image, and the sketch a lesson came from are kept with saved lessons. See [docs/lesson-library.md](docs/lesson-library.md).
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

The browser tests use a synthetic local provider fixture. Some HTTP and browser tests need localhost socket access. Test results describe the checked revision and do not establish scientific or teaching correctness.

## Architecture and hosting

See the maintained [architecture diagram and technology stack](docs/architecture.md). Update that document with changes to system components, integrations, model roles, storage or deployment.

The cloud entry point is `api/index.js`. It requires shared Redis configuration and an explicitly allowed HTTPS origin, uses the hosted Meta provider, and does not honor local open-access mode. Configure secrets only as server-side environment variables. Adding a static asset to `public/` also requires checking local serving and production copying in `src/static.mjs` and `scripts/build-vercel.mjs`.

## Source and assets

Application source is licensed under [MIT](LICENSE); third-party packages retain their own licenses. The six gallery show covers were generated with Muse Image and the sketch-pendulum lesson uses a hand-drawn sketch according to the source project. The repository includes synthetic test fixtures and excludes local environment files and generated evaluation output. The author keeps the detailed provenance record locally and will provide it on request.
