# src/: conventions

Applies with the root `AGENTS.md`.

- Express 5, ES modules, Node 26, no TypeScript. The code is dense (long lines); match the
  surrounding file and do not reformat it. Prettier does not run here.
- `createApp` in `server.mjs` wires everything; `cloud.mjs` builds the hosted configuration
  (`EXPLAINBACK_PUBLIC_ORIGINS`, Redis, Blob) and `api/index.js` wraps the app as one
  serverless function with a 60-second limit. Plan request budgets from the start of the
  request: the show route uses 53 s, compare 55 s, and judge calls are skipped when too
  little remains.
- Client-facing failures are `throw new RequestError(status, 'Fixed sentence.')`
  (`request-error.mjs`). Provider or Redis messages never reach the response. Keep existing
  error codes stable; the client matches on them.
- Access: `tester-auth.mjs` (password tester and administrator), `access-codes.mjs` (invite
  codes with hourly budgets), `judge-access.mjs` + `judge-redis.mjs` + `judge-challenge.mjs`
  (credential-free trial with per-session and per-day call ceilings). A judge identity always
  carries `audience.kind === 'judge'` and can never satisfy the administrator check.
- Every provider call goes through the wrapped callers (`metered` in `server.mjs`) so it is
  counted, budgeted and traced. Background dispatch counts once; polling is free.
- State: `state.mjs` is the in-memory adapter, `redis-state.mjs` the Upstash one. Any
  check-then-write is a Lua script, and both adapters must satisfy the contract suites in
  `test-support/` (`*-contract.mjs`). With `EXPLAINBACK_TEST_REDIS` pointing at a
  `redis-server` binary, `npm test` runs them against real Redis; CI always does.
- Hosted responses are JSON only, `Cache-Control: no-store`, with per-route byte limits and
  the origin and `Sec-Fetch-Site` checks in `server.mjs`; security headers must stay in
  parity between `server.mjs` and `vercel.json` (`test/operations.test.mjs` checks).
- Tests: `node --test test/<name>.test.mjs`; HTTP tests start the app on a loopback port with
  the synthetic provider in `test-support/`. Never call a real model from a test.
