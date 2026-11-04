# What a reviewer sees when something is missing or fails

The fixture server can exercise these conditions (`scripts/browser-test-server.mjs` reads `FIXTURE_*` variables; see its header). Every message exists in English and Chinese, and a notice set in one language is cleared when the language changes rather than left in the old one.

| Condition | What happens | Where it is said |
|---|---|---|
| The access code's hourly budget is used up (429) | The request is not sent to the model. The notice says the budget is used up, that saved and reviewed lessons still open, and to try next hour. The header strip refreshes to `0/n`. The judge path greys its request steps, explains why in the footer, and still lets Save and Share run. | `Studio.failBudget`, `JudgePath.noHourlyBudget` |
| The provider session's own request cap is reached | A notice offers to start a new provider session; the judge path footer says so. | `Studio.thisProviderSessionHasUsed`, `JudgePath.noBudget` |
| Another request is in flight or the session was reset (409) | "Wait a moment, then retry." | `Studio.failConflict` |
| The chosen model is not configured (503) | "Choose another model or ask the host to configure it." | `Studio.failNotConfigured` |
| Sign-in ended (401) | Sign-in is required again. The private browser workspace is cleared when access is lost; export work before a temporary session ends. | `Studio.failSignIn`, `useTesterAuth.loseAccess` |
| A request body is too large (413) | "Use a smaller image or a shorter text." | `Studio.failTooLarge` |
| A model reply failed or was rejected (502) | The generic line plus the server's rejection reason when it has one; the draft is preserved. | `Studio.theRequestCouldNotBe`, `Studio.reason` |
| The background Wonder job passes its deadline | "Wonder is still working in the background. Keep this page open, or start a new request." | `Studio.backgroundStillRunning` |
| The show came back without a cover for lack of time | The show opens; the notice says there was no time for a cover and points to Draw a cover in the player. | `Studio.theShowIsReadyNoCover` |
| No image model on the server | Covers, illustrations and the illustrator controls are absent; the judge path marks that step "Not on this server"; credits omit the image line. | `JudgePath.unavailable` |
| No Blob storage | Saving works; the notice adds that images are not kept on this server. | `Library.imagesNotKept` |
| No SAM 3.1 | The Spotlight shows the sketch without the search form. | — |
| A shared link was turned off | The visitor sees "This shared lesson is not available" with a link to the library. | `Library.sharedUnavailable` |
| A saved copy could not be stored (shelf limit reached, or a bad image) | The server's reason is shown; nothing is lost in the browser. | server messages |
| Empty states | An empty shelf, a catalog search with no match and a public list with no shared lessons each say so in a sentence. | `Library.nothingSavedYet`, `Gallery.noMatches` |

A chained turn whose earlier response is gone is retried once without the chain before any failure is shown. Failure messages are chosen by HTTP status in `failureMessage` (`frontend/components/Studio.tsx`), so the server's English sentences never reach a Chinese reader.

## Temporary Judge access

Judge access can be disabled independently of public viewing. If it is disabled,
the entry is absent on a freshly loaded page, and existing trial access is rejected
on the next authenticated request. Incorrect, expired or replayed quick checks require
a new check and preserve an existing login. Session expiry, session call exhaustion,
shared daily exhaustion and start cooldowns are separate conditions; a new session
does not clear the daily limit. See the [Judge mode guide](judge-mode.md) for visitor
steps and [operations](operations.md#public-trial-access) for administrator recovery.
