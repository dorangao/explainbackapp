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
| Reviewers see "The hourly request budget for this access is used up" | The code's hourly action budget (the number after the date in `EXPLAINBACK_ACCESS_CODES`) is spent; an action can make multiple provider calls | Wait for the fixed window to reset. If changing the quota, redeploy and sign in again to receive it. Saved and gallery lessons keep working. |
| "Sign in to tester access" right after signing in | The session cookie was replaced by a newer sign-in from the same browser, or the code was removed | Sign in again. Removing or rotating a code invalidates its sessions on their next request. |
| Draft or show times out | Provider work exceeded the configured request or job deadline | For background creation, keep the page open and let polling finish before starting another request. If it fails, check provider availability and configuration before retrying. |
| Images missing from saved lessons | `BLOB_READ_WRITE_TOKEN` missing, or the store is unreachable | The app says images were not kept and saves the lesson without them. Set the token in the Vercel project and redeploy. |
| SAM Spotlight or the microphone control is hidden | The feature is disabled when its model call is not configured | Both need `MODEL_API_KEY`; the microphone also needs a secure context and the user's permission. |
| Orphaned images on Blob | Test runs or deleted shelves before the delete-on-remove rule | Run `node scripts/prune-blobs.mjs` with the token and Redis variables in the environment; it lists first and deletes only with `--live` (default: images older than 7 days that no saved lesson in any environment uses). |
| Every saved lesson and share link disappeared after a deployment | The tester username or password changed. Every Redis key, including saved lessons, is namespaced by a hash of those credentials so that old cookies die with them | Restore the previous credentials to see the records again. Rotating the tester credentials needs a copy of the `lesson:*`, `owner-lessons:*`, `shared-lessons` and `covers` keys into the new prefix first; without it the saved lessons are invisible and `prune-blobs.mjs` will treat their images as orphans after seven days. |

## Changing configuration

Environment variables apply to new deployments only. After changing a variable in the
Vercel project (production and preview are separate), create a deployment to activate it.
Production requires `EXPLAINBACK_PUBLIC_ORIGINS` to contain only the intended HTTPS app
domains. Vercel aliases are not accepted automatically in Production; API requests to
them return 403. Preview retains its deployment/branch hosts. Keep health monitors on
an allowed domain. Test normal browser reads/writes and rejected foreign-origin calls
after changing this allowlist. Custom WAF rules are an optional earlier rejection layer;
origin headers never replace authentication or model-call budgets.
For the hosted Judge trial, maintain IP-based WAF rules for login bursts, API writes
(excluding polling), and a generous API traffic backstop. These are platform settings,
not part of a Git deploy. Use `vercel firewall overview` and `vercel firewall diff`
with the intended project/scope before publishing changes. Start new thresholds in
log mode, inspect traffic in the Firewall dashboard, and test enforcement in Preview
before Production. Keep account-specific thresholds and release evidence private.
WAF limits are regional; do not remove the atomic Redis daily model budget. To undo
an overly strict rule, change its exceeded action back to log and publish that draft.
Reviewer labels, quota plans and distribution records belong in the separate private
repository. Code values and live invite links stay out of both repositories; see
`docs/repo-guidelines.md`.

## Rolling back

Every push to `main` deploys. To roll back, promote the previous production deployment in
the Vercel dashboard (instant, no rebuild), then revert the commit on `main` so the next
push does not redeploy the problem. The build attestation for each `main` commit is on the
repository's Actions run (`gh attestation verify explainback-dist.tgz --repo dorangao/explainbackapp`).

## Not in place

No metrics or trace export to a collector, no alerting, no on-call. The health route and the
request log are what an operator has; `docs/security.md` lists this as an open item.

## Public trial access

Set the server-only `EXPLAINBACK_JUDGE_MODE=1` in the intended environment and deploy
to enable the public Judge mode entry. Missing or `0` leaves it disabled. Deploying
with the flag disabled rejects existing judge sessions on their next request. Keep
Production and Preview configuration separate and preserve the Redis namespace while
a trial is active; changing credentials or the namespace resets the existing state.

Sign in with the private tester/administrator account and open **Judge usage** to
inspect session counts and the current UTC-day allowance. Refresh that view for current
usage. Start throttling, expired sessions, session exhaustion and daily exhaustion have
distinct responses. Daily exhaustion resets at midnight UTC; restarting a session does
not reset the daily counter. Public library viewing remains available. See
[architecture.md](architecture.md#public-judge-trials) for accounting and retention.

A `JUDGE_START_LIMIT` response reports the remaining client-burst or global-issuance
wait in seconds through `Retry-After` and `retryAfter`. Wait for the displayed countdown;
rejected starts leave an existing session usable. A non-JSON `429` can come from the
edge firewall: inspect the matched WAF rule and traffic, rather than resetting Redis
counters or changing credentials. Missing source headers and foreign origins return
`403`, a separate failure from either rate limiter.

Judge sign-in also requires a fresh quick check. A reviewer can read the image or
choose the accessible text check; neither spends model calls. Incorrect, expired or
replayed answers require a new check and leave an existing login intact. Reload an
older open sign-in page after deploying this requirement.

In **Judge usage**, the tester administrator can choose **Reset start cooldowns**,
**Reset daily allowance**, or **Reset session allowance** for an active row. Supply
a short operational reason (no credentials or personal information), confirm the
scope, then refresh usage. Restoring calls can increase spending beyond the ordinary
allowance. The original session expiry, usage records and total daily calls remain;
the allowance-used value counts from the last reset. The latest reset history is
shown below the table. These controls do not change Vercel rules or clear other
networks' individual cooldowns. A stale/expired session reset returns `409` without
signing the administrator out.

Public trials share a bounded workflow pool and a bounded saved-lesson pool. Save/share
attempts are limited separately from model calls. If trial storage is full, the admin
can review and delete older trial lessons using the existing administrator library;
deleting frees capacity. Generated show images remain browser-local until an explicit
save, so merely generating a temporary show does not leave orphaned Blob uploads.
