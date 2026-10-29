# ExplainBack / 讲给我听

ExplainBack turns a question or sketch into a bilingual, reviewable interactive lesson. A learner predicts, operates an experiment, explains the result, and tries a fresh case. Muse can help draft and revise the lesson; application code validates the lesson contract and calculates its outputs.

ExplainBack 把问题或草图变成可审阅的中英双语互动课程。学习者先预测，再操作实验、解释结果，并尝试新的情境。

This is a **submission candidate** based on the ExplainBack source snapshot identified in [PROVENANCE.md](PROVENANCE.md). Its source has not yet been independently established as event-only, and publication of this repository is separate from submitting the project. The existing live product at [explainback.app](https://explainback.app/) is a separate deployment and is not evidence that this candidate has been deployed or verified.

## Experience

- Open a reviewed gallery lesson or narrated show without signing in. Gallery playback uses included lesson data and generated cover assets and does not make a model request.
- In Lesson Studio, request a new lesson or revision, review its assumptions and definition, and explicitly present it. Structured, bounded lesson data is interpreted by the app; generated JavaScript is not executed.
- Where configured, Muse can draft and revise lessons, try them as a learner, evaluate an explanation, write a show script, generate its cover, or transcribe spoken explanations. Voice playback for shows uses the browser's speech synthesis.
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

The browser tests use a synthetic local provider fixture. Some HTTP and browser tests need localhost socket access. On October 28 Pacific, Node 22 validation passed 259 Node tests, 30 component tests and 18 browser tests; typecheck, lint (warnings), formatting and the production build also passed. A clean offline install and build succeeded. One small live Meta text request succeeded through the SDK; the complete live lesson flow and hosted deployment remain to be checked.

## Architecture and hosting

React and TypeScript provide the interface; Node serves API requests and the built assets. The HTTP layer uses Express, and the fixed-function graph uses D3 scales and line generation. The Meta Responses transport uses the OpenAI-compatible Node SDK against Meta’s endpoint with retries disabled. The candidate retains lesson validation, session quotas and the separate authentication boundary. Exact implementation and verification are tracked in [the implementation plan](docs/implementation-plan.md).

The cloud entry point is `api/index.js`. It requires shared Redis configuration and an explicitly allowed HTTPS origin, uses the hosted Meta provider, and does not honor local open-access mode. Configure secrets only as server-side environment variables. Adding a static asset to `public/` also requires checking local serving and production copying in `src/static.mjs` and `scripts/build-vercel.mjs`.

## Source and assets

Application source is licensed under [MIT](LICENSE); third-party packages retain their own licenses. The six gallery show covers were generated with Muse Image and the sketch-pendulum lesson uses a hand-drawn sketch according to the source project. Review asset rights and provenance before publication. The repository includes synthetic test fixtures and excludes the source project's historical baseline archives, local environment files and generated evaluation output. See [PROVENANCE.md](PROVENANCE.md) for the timeline evidence and unresolved eligibility questions.
