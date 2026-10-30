# Security notes and standards alignment

Engineering alignment only. Nothing here is a certification, an audit result or a
production-readiness claim. The app is a hackathon prototype with a shared tester account,
reviewer invite codes and paid model calls behind them; the controls below exist to keep
that prototype honest, not to meet a compliance bar.

## What is protected and from whom

| Asset | Threat | Control |
|---|---|---|
| Provider key, Blob token, Redis credentials | Leak through the repository, logs or responses | Server-only environment variables; `scripts/scan-secrets.mjs` runs in CI over every tracked file; the trace console redacts the key, the tester password and every access code; errors reaching the browser are our own messages, never provider or stack text (`src/request-error.mjs`). |
| Hourly model budget | Abuse by anonymous visitors or a leaked code | Every model call needs a session; each code has its own hourly budget and a cap on live sign-ins; failed sign-ins are limited per visitor (5 a minute) with a global backstop (100 a minute). |
| Session cookie | Theft or forgery | Random id, `HttpOnly`, `SameSite=Strict`, `Secure` in the cloud, 8-hour expiry, replaced on re-login, revoked on logout or when the code is removed. |
| State-changing routes | Cross-site requests | Every `POST` checks that `Origin` equals the allowed origin; JSON only; no compressed bodies; per-route byte limits; `Cache-Control: no-store` everywhere. |
| The page | Script injection, framing, data exfiltration | CSP with `default-src 'self'`, no inline script or style, images only from self, data URLs and the Blob host; `frame-ancestors 'none'`; `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` allowing only the microphone to this origin. Vercel adds HSTS. |
| Model replies | Prompt injection through lesson text, instructions that reach the renderer | Replies are structured output validated against our schemas (`public/lesson-schema.mjs` and the readers in `src/`); formulas are compiled and range-checked by code; the model never returns code, URLs or HTML; lesson prose is labelled untrusted in every prompt. |
| Saved lessons and images | Access by other users, guessable links | Shelves are keyed by owner (code label or tester); share links use unguessable ids; images live under an owner prefix on Blob at unguessable public URLs; deleting a lesson deletes its images. |

Known, deliberate gaps: the tester account is one shared password (a prototype
convenience, documented in `.env.example`); there is no per-user identity; the Blob URLs
are public to anyone holding them, which is what a share link needs.

## Checks that run on every change

- `npm run scan:secrets`: fails CI on a committed key, token, private key, Redis URL with
  credentials or a real access-code assignment (placeholders are allowed).
- `npm run audit:prod`: fails CI on a high or critical advisory in a production dependency.
  Dev-only advisories are reviewed through Dependabot (`.github/dependabot.yml`, weekly, grouped).
- `test/operations.test.mjs`: every response carries the header set in `safeHeaders`, and
  `vercel.json` sends the same values for static files, so the two cannot drift.
- `test/server.test.mjs`, `test/lesson-http.test.mjs`, `test/access-codes.test.mjs`: origin
  checks, body limits, sign-in limits, redaction, session expiry and revocation.
- `e2e/accessibility.spec.ts`: axe-core WCAG 2.1 A/AA audit over the library, a lesson,
  the show player, the signed-in studio and a draft review; serious or critical findings fail.

## Standards alignment

| Baseline | Label | Repo evidence | Still open |
|---|---|---|---|
| OWASP ASVS input and session controls | Partial | Origin checks, byte limits, JSON-only bodies, redacted errors, `HttpOnly`/`SameSite` cookies, sign-in rate limits, header set tested against the deployment config. | Shared tester password; no per-user identity; no formal ASVS level claimed. |
| NIST SSDF secure development | Partial | CI verifies types, lint, format, tests and the build on every change; lockfile with `npm ci`; secret scan and production dependency audit in CI; Dependabot for npm and Actions; provenance notes kept privately. | No code-owner review requirement; eligibility review is an organiser question. |
| WCAG-oriented UI | Partial | Skip link, language switch, `aria-current`, focus on route change; automated axe audit in CI over five screens with zero serious findings. | No manual screen-reader or keyboard audit; automated checks cover a minority of WCAG criteria. |
| OpenTelemetry / operator telemetry | Partial | `GET /api/health` liveness route; one JSON line per API request on Vercel (method, path, status, duration, platform request id); runbook in `docs/operations.md`. | No metrics or trace export to a collector; no alerting. |
| SLSA build provenance | Partial | On every push to `main`, CI builds the site and signs a Sigstore attestation over the archived build (`actions/attest-build-provenance`), verifiable with `gh attestation verify`. | The attestation covers CI's build of the commit, not the Vercel deployment, which builds the same commit separately; no SLSA level claimed. |

Keep this table honest: change a label only with a change in the evidence column.
