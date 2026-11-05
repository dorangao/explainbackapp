# ExplainBack: instructions for coding agents

This file is the operating manual for any coding agent working in this repository
(Codex, Claude Code via `CLAUDE.md`, Cursor, Devin, Copilot). Humans are welcome to read it
too; `CONTRIBUTING.md` is the shorter human version. Scoped notes live in
`frontend/AGENTS.md` and `src/AGENTS.md`; read the one for the area you change.

## What this is

ExplainBack turns a question or a sketch into a bilingual (English and Chinese) interactive
lesson: predict, run the experiment, explain the result, try a fresh case. It is deployed at
https://explainback.app from this repository.

**The one invariant.** The model writes a *lesson contract* (claim, variables, ranges,
formulas as text, explanation, fresh case). Application code compiles and range-checks the
formulas, computes every number, and marks every learner answer. Generated code is never
executed; a malformed contract is rejected, not repaired; the model coaches on an
explanation but never grades it on its own. Keep that line wherever you touch the flow, and
keep the wording that generated lessons and model feedback are not verified science or
evidence of teaching effectiveness.

## Repository map

| Path | What lives there |
|---|---|
| `frontend/` | React 18 + TypeScript + Vite client. `App.tsx` routes by URL hash; `components/` one component per file with its `*.test.tsx` beside it; `lib/` pure modules (`api.ts` session and fetch layer, `messages.ts` every user-facing string in both languages, `types.ts`); `hooks/`; `components/labs/` the claim-testing labs |
| `public/*.mjs` | Shared engines as plain ES modules used by the browser *and* the server tests: lesson schema and player, formula catalog and plot, canvas validation, gallery lessons and shows. No bundler-only syntax here |
| `src/` | Express 5 server. `server.mjs` builds the app (`createApp`) and holds the action routes; `lesson-routes.mjs` saved and shared lessons; `state.mjs` / `redis-state.mjs` the in-memory and Upstash Redis state adapters (same contract); `tester-auth.mjs`, `access-codes.mjs`, `judge-*.mjs` access; `meta.mjs` and `llm/` the model transport; `cloud.mjs` the hosted configuration |
| `api/index.js` | The single Vercel serverless function; wraps the Express app |
| `scripts/` | Build (`build-vercel.mjs`), dev server, the Playwright fixture server, evaluation and operations scripts |
| `test/` | Server and engine tests on `node --test`; `test-support/` fixtures and the memory/Redis contract suites |
| `e2e/` | Playwright specs against a synthetic provider, including an axe accessibility audit |
| `eval/` | Frozen evaluation cases and checksums described in `docs/evaluation.md` |
| `docs/` | `architecture.md` (system shape, model roles, stack table, hosted boundary, judge trials), feature docs, `security.md`, `operations.md`, `repo-guidelines.md` (what may be committed here) |

## Setup and commands

Node 26 (`nvm use` reads `.nvmrc`). Install with `npm ci --ignore-scripts`.

| Task | Command | Notes |
|---|---|---|
| Run the production build locally | `npm run build && npm start` | http://127.0.0.1:4173; the library works without a model key |
| Develop with Vite | `npm run dev` | `npm run dev:open` skips sign-in locally; the hosted handler refuses that mode |
| Fast checks | `npm run check` | typecheck, lint, server tests, client tests |
| Everything CI runs except the browser | `npm run verify` | secret scan, Prettier check, `check`, build |
| Everything including Playwright | `npm run verify:browser` | needs `npx playwright install chromium` once |
| One server test file | `node --test test/judge-access.test.mjs` | |
| One client test file | `npx vitest run frontend/components/Library.test.tsx` | jsdom, Testing Library |
| One browser spec | `npm run build && npx playwright test e2e/library.spec.ts` | the fixture server serves `dist/`; without a build Playwright fails with "Timed out waiting 15000ms from config.webServer" |
| Format TypeScript | `npm run format` | Prettier covers `frontend/`, `e2e/` and the root `*.ts` only |

The Playwright fixture (`scripts/browser-test-server.mjs`) needs no credentials and makes no
paid calls; `FIXTURE_*` environment variables select failure modes for the error-state specs.
Setting `EXPLAINBACK_TEST_REDIS` to a `redis-server` binary runs the Redis Lua contract tests
too; CI does this, so a change to a Lua script is only proven green in CI.

CI (`.github/workflows/verify.yml`) runs, in order: `scan:secrets`, `audit:prod`, `typecheck`,
`lint`, `format:check`, `test` with real Redis, `test:unit`, `build`, `test:browser`. The job
"Node 26 / build and browser checks" is a required status check on `main`.

## Conventions

- **Every user-facing string is bilingual.** Add a key to `frontend/lib/messages.ts` with
  both `en` and `zh`, and render it with `t(language, key)`; for a one-off inline pair use
  `say(language, en, zh)` from `frontend/lib/types.ts`. No bare English literals in JSX.
- **Errors to the browser are structural.** Throw `RequestError(status, message)` from
  `src/request-error.mjs` with a fixed sentence; never forward provider or Redis text. Codes
  such as `JUDGE_*` and `TESTER_REQUIRED` are matched by the client, so keep them stable.
- **Every provider call is metered and budgeted.** New model, image, transcription or
  segmentation calls must go through the wrapped callers in `src/server.mjs` (`metered`), count
  against the access budget, and respect the request budget: one hosted function has 60 s,
  the show route plans for 53 s and compare for 55 s. Measure from the start of the request.
- **State mutations are atomic.** Anything that checks-then-writes in Redis is a Lua script in
  `src/redis-state.mjs` or `src/judge-redis.mjs`, with the same behaviour in the memory adapter
  and a contract test in `test-support/` that runs against both.
- **Accessibility is tested.** Interactive elements get names and roles; focus is managed when
  content is replaced; `e2e/accessibility.spec.ts` runs axe on the main pages.
- **Style.** `frontend/` and `e2e/` are Prettier plus oxlint; run `npm run format` before a
  PR. `src/`, `public/*.mjs`, `scripts/` and `test/` are not under Prettier and are written
  densely; match the surrounding file and do not reformat it wholesale.
- **Tests go next to the behaviour.** `test/` for server and engines, `frontend/**/*.test.tsx`
  for components, `e2e/` for flows. A fix comes with the regression that failed before it.
- **Docs in the same change.** When components, integrations, model roles, storage or
  deployment change, update `docs/architecture.md` and the stack table in it; feature docs
  follow their feature. Update this file when commands or conventions change.

## Boundaries

- This repository is public. `docs/repo-guidelines.md` is the rule: code, tests and
  how-it-works docs belong here; demo scripts, judging material, work logs, measured quotas,
  account-specific settings and access-code labels do not. Implementation constants in source
  are fine; numbers about a particular deployment or event are not.
- Never commit `.env.local`, credentials, tokens, invite links or share links. `.env.example`
  holds variable names and guidance only. `npm run scan:secrets` runs in CI but is not a
  substitute for reading your own diff.
- Do not weaken the origin guard, session ownership checks, write ceilings or metering to make
  a test pass; make the test use the fixtures in `test-support/`.
- Do not add a dependency without a reason in the PR; `audit:prod` fails CI on high findings.
- Do not run the live evaluation or gallery scripts (`eval:*`, `shows:gallery`, `claim:smoke`)
  as part of ordinary work: they spend money on the configured key.

## Git workflow

- Branch from `main`, open a pull request, let the required check pass, then merge; squash,
  merge and rebase are all allowed and the branch is deleted on merge.
- Several agents and people may share one checkout. Before you start, run `git status` and
  note the branch; work on your own branch or worktree and never switch a branch someone else
  has checked out.
- Commit subjects are short and imperative. Keep your tool's co-author trailer so the history
  says who did what. Fill in the pull request template, including the docs and
  nothing-private checkboxes.

## Known traps

- On Vercel, Express's `req.query` can be shadowed by a legacy parser; parse the raw URL with
  WHATWG `URL` as `requestCursor` in `src/lesson-routes.mjs` does.
- The service worker (`public/sw.js`) caches the app shell and never `/api/`; when you change
  what it precaches, bump its `VERSION` constant or returning visitors keep the old shell.
- Production accepts API requests only from the origins in `EXPLAINBACK_PUBLIC_ORIGINS`;
  preview deployments also accept their Vercel hosts. A 403 "host is not allowed" in a new
  environment is configuration, not a bug.
- The gallery fetches every shared page eagerly and paginates client-side; library tests that
  count cards depend on the page-size options (9, 18, 36).
- `oxlint` reports a few pre-existing warnings under `frontend/components/labs/`; warnings do
  not fail CI, errors do.
