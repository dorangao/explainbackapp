# Security policy

ExplainBack is a hackathon prototype maintained by one person. It is deployed at
[explainback.app](https://explainback.app) from the `main` branch of this repository.
What the app protects, and how, is described in [docs/security.md](docs/security.md).

## Reporting a vulnerability

Please do not open a public issue for a security problem.

1. Use **Report a vulnerability** on this repository's Security tab (GitHub private
   vulnerability reporting). The report reaches the maintainer only.
2. If that option is not available, open an issue titled "Security contact request"
   with no details; the maintainer will reply with a private channel.

Include what you found, how to reproduce it, and what you think the impact is. You
will get an acknowledgement within a few days and a note when it is fixed or when the
maintainer decides not to change it. There is no bounty programme.

## Scope

In scope: this repository's code and the hosted app at explainback.app, including the
sign-in and session handling, the saved-lesson and share routes, the image storage
rules, the request budgets and the content security policy.

Out of scope: the behaviour of Meta's Muse models themselves, the Vercel and Upstash
platforms, and findings that need a load test or a budget-exhaustion run against the
hosted app. Please test rate limits and budgets on a local checkout
(`npm run dev:open` with the synthetic provider used by the browser tests), not on the
hosted site, where every model request costs money.

## Supported versions

Only the current `main` branch and the deployment built from it are supported. The
build the site is running is reported by `https://explainback.app/api/health`.
