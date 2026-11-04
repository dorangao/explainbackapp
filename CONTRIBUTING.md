# Contributing to ExplainBack

Thank you for looking at the code. This document covers how to run it, what a change
should include, and what this public repository does and does not hold.

## Setup

- Node 26 (`nvm use` reads `.nvmrc`) and npm.
- `npm ci --ignore-scripts`, then `npm run build` and `npm start`, or `npm run dev` for
  Vite tooling. The gallery and shared lessons work without a model key.
- For live lesson creation copy `.env.example` to `.env.local` and fill in your own
  `MODEL_API_KEY` and tester credentials. That file is ignored; never commit it.
  Model calls are explicit actions and cost money on your key.
- The browser tests run against a synthetic local provider, so they need no key.

## Before opening a pull request

Run the same checks CI runs:

```sh
npm run check          # typecheck, lint, server tests, client tests
npm run format:check   # Prettier over frontend and e2e
npm run scan:secrets
npm run build
npm run test:browser   # Playwright; `npx playwright install chromium` once
```

Then make sure of the following:

- **Tests.** New behaviour comes with a test next to the existing ones: `test/` for the
  server and shared engines (`node --test`), `frontend/**/*.test.tsx` for components
  (Vitest), `e2e/` for browser flows.
- **Docs in the same change.** When the system's shape changes (components, integrations,
  model roles, storage, deployment), update `docs/architecture.md`; feature docs such as
  `docs/lesson-library.md` follow the feature they describe. See `AGENTS.md`.
- **The human-review boundary.** Generated lessons, formulas, claims and model feedback
  are not verified science or evidence that teaching worked. Keep that wording where the
  app or the docs describe them.
- **Nothing private.** [docs/repo-guidelines.md](docs/repo-guidelines.md) says what
  belongs here. Credentials, access-code values, invite links, quota numbers and demo or
  judging material do not; `.env.example` holds names and guidance, never values.

## Style

- TypeScript in `frontend/` and `e2e/` is formatted with Prettier and linted with oxlint
  (`npm run format`, `npm run lint`).
- The server and shared modules (`src/`, `public/*.mjs`, `scripts/`, `test/`) are not yet
  under Prettier and are written densely. Match the surrounding file for now; a
  repository-wide format is planned once judging of the event entry is over.
- Commit subjects are short and imperative. Changes written with an AI coding tool are
  welcome; keep the tool's co-author trailer so the history says who did what.

## Reporting problems

- A bug or a wrong figure in a lesson: open an issue. The lesson pages have a
  **Report this lesson** link that prefills one.
- A security problem: see [SECURITY.md](SECURITY.md); please do not file it publicly.

## Licence

By contributing you agree that your contribution is licensed under the repository's
[MIT licence](LICENSE).
