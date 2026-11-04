# Trying ExplainBack with Judge mode

Judge mode offers temporary, credential-free access to live creation for evaluation.
It may be paused or disabled at any time, including during an active session. The
public library and included narrated shows can still be explored without signing in
or making model calls.

## Start a session

1. Open [ExplainBack](https://explainback.app/). Select **Judge mode** when available;
   on a phone, access and appearance controls are inside **Menu**.
2. Enter the digits from the quick-check image, or choose **Use a text check** and
   answer the addition question. **New image** requests a replacement. This check
   does not use an AI call, and no invite code is needed.
3. Select **Start Judge mode**. The Create page opens with a private workspace.
4. Enter a question, create a lesson and review its assumptions and definition.
   The optional six-step tour shows the cost of each step before you run it.

The image/text answer is a short-lived, single-use check. It is separate from the
**Reviewer access code** field, which is for privately issued access codes.

## Session limits and keeping your work

- While access is enabled, a session lasts up to 30 minutes and allows up to 50
  provider calls, subject to the shared daily allowance and rate limits. The banner
  shows the remaining calls and time. Refreshing does not extend the expiry.
- An action can use more than one call, such as narration plus illustrations.
  Failed provider calls and retries count too; the quick sign-in check does not.
- Use **New lesson** to make another lesson within the same Judge session. Starting
  a new Judge session creates a separate workspace and revokes the previous login;
  it does not reset the shared daily allowance.
- **New judge session** stays hidden while time and calls remain. It appears when
  the session expires or runs out of calls and opens the quick check for a new
  session. If an administrator restores calls before expiry, it hides again.
- **Export lesson JSON** to keep your work before signing out, restarting or expiry.
  The private browser workspace is cleared when access ends. Saving has separate
  limits; export remains available while the workspace is accessible if saving is full.
- Administrators can inspect session usage and saved lessons. Judge mode does not
  verify anyone's identity or grant administrator access. Use synthetic examples.

Generated lessons, explanations and model feedback still require human review.
Successful generation is not evidence of scientific correctness or teaching effectiveness.

## If live access is unavailable

| What you see | What to do |
|---|---|
| No Judge mode button, or “Judge mode is currently unavailable” | Refresh once. The host may have disabled temporary access. Browse public lessons and included shows, or use the [local setup](../README.md#local-setup) with your own configuration. |
| An incorrect, expired or already-used quick check | Request a new image or text check. A rejected answer does not replace an existing session. |
| A countdown or too many requests | Wait for the indicated cooldown before trying again. An edge firewall limit may also apply. |
| The session has expired or its call allowance is used up | Public lessons remain available. Export while your workspace is still accessible; an expired workspace cannot be resumed by starting another session. |
| The shared daily allowance is used up | Try after its UTC-day reset or explore the public library. Starting another session does not replenish this allowance. |
| A model request fails | Review the displayed message and retry explicitly if appropriate. A failed call can still count toward the allowance. |

For operator configuration and recovery controls, see [operations](operations.md#public-trial-access).

## Feedback and inquiries

Email [contact@sketchplaywrite.com](mailto:contact@sketchplaywrite.com) for feedback,
questions or inquiries about temporary access. For reproducible bugs or incorrect
lesson figures, you can also [open an issue](https://github.com/dorangao/explainbackapp/issues/new/choose).
Please omit credentials, access codes and personal or student information. Security
reports should follow [SECURITY.md](../SECURITY.md).
