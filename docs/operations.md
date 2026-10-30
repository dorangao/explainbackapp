# Operations runbook

How to tell whether the hosted app is healthy, where to look when it is not, and what each
recovery step does. The hosted app runs on Vercel (one serverless function, `api/index.js`)
with Upstash Redis for sessions and budgets and Vercel Blob for images.

## Is it up?

| Check | Expect | If not |
|---|---|---|
| `GET https://explainback.app/api/health` | `200 {"status":"ok","build":"<7-char commit>"}` | The function did not start: check the latest deployment's build log in Vercel, then roll back (below). |
| `GET /api/auth` | `200` with `configured: true` | `configured: false` means `MODEL_API_KEY` is missing in the environment. |
| Sign in with a reviewer code, then `GET /api/status` | `access.remaining` shows the hour's budget | A `503 ... not configured` or a Redis error on login means the Redis variables are missing or the store is down. |
| Open a gallery lesson signed out | Loads with no network request to `/api/studio/*` | The static site is served from the same deployment; a blank page is a build problem, not a provider problem. |

The health route needs no sign-in and touches no state, so an uptime monitor can poll it
every minute without spending anything.

## Where the logs are

- **Request log.** On Vercel every API request writes one JSON line to the function's
  stdout: `{"at","method","path","status","ms","id"}`. `id` is Vercel's request id, so a
  user's error can be matched to a log line without storing anything about them. Query
  strings, bodies, cookies and codes are never logged. Locally set
  `EXPLAINBACK_REQUEST_LOG=1` to see the same lines; `EXPLAINBACK_REQUEST_LOG=0` turns them
  off on Vercel.
- **Configuration warnings.** Malformed `EXPLAINBACK_ACCESS_CODES` entries are reported by
  position at startup (`EXPLAINBACK_ACCESS_CODES entry 3 ...`), never by value.
- **Provider trace.** `EXPLAINBACK_TRACE=1` enables the in-app provider console for signed-in
  testers. It shows redacted request and response data and can expose checked answers, so
  it is a developer setting, off in production.
- **Error states the user sees** are listed with their causes in `docs/error-states.md`.

## Common situations

| Symptom | Likely cause | What to do |
|---|---|---|
| Reviewers see "The hourly request budget for this access is used up" | The code's hourly budget (the number after the date in `EXPLAINBACK_ACCESS_CODES`) is spent; one full tour is 3 requests, one hand-driven demo 6 to 8 | Wait for the fixed hour to roll over, or raise the budget for that code and redeploy. Saved and gallery lessons keep working. |
| "Sign in to tester access" right after signing in | The session cookie was replaced by a newer sign-in from the same browser, or the code was removed | Sign in again. Removing or rotating a code invalidates its sessions on their next request. |
| Draft or show times out | Wonder requests take 20 to 35 s; the function budget is 55 s | Retry once. Background creation (the default for Wonder) survives a slow first request by polling. If every request fails, check the provider status page and the key. |
| Images missing from saved lessons | `BLOB_READ_WRITE_TOKEN` missing, or the store is unreachable | The app says images were not kept and saves the lesson without them. Set the token in the Vercel project and redeploy. |
| SAM Spotlight or the microphone control is hidden | The feature is disabled when its model call is not configured | Both need `MODEL_API_KEY`; the microphone also needs a secure context and the user's permission. |
| Orphaned images on Blob | Test runs or deleted shelves before the delete-on-remove rule | Run `node scripts/prune-blobs.mjs` with the token and Redis variables in the environment; it lists first and deletes only with `--live` (default: images older than 7 days that no saved lesson uses). |

## Changing configuration

Environment variables apply to new deployments only. After changing a variable in the
Vercel project (production and preview are separate), create a deployment to activate it.
Reviewer codes, their labels, quotas and who received them belong in private notes, never
in the repository (`docs/repo-guidelines.md`).

## Rolling back

Every push to `main` deploys. To roll back, promote the previous production deployment in
the Vercel dashboard (instant, no rebuild), then revert the commit on `main` so the next
push does not redeploy the problem. The build attestation for each `main` commit is on the
repository's Actions run (`gh attestation verify explainback-dist.tgz --repo dorangao/explainbackapp`).

## Not in place

No metrics or trace export to a collector, no alerting, no on-call. The health route and the
request log are what an operator has; `docs/security.md` lists this as an open item.
