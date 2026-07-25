---
name: kindle-setup
description: Configure and verify the local Kindle delivery capability for the current Windows or macOS user. Use for first-time setup, QQ SMTP reauthorization, Kindle address or approved-sender changes, capability states other than ready, or repair after kindle capability reports a problem.
---

# Kindle Setup

Deploy the capability only after a real Kindle device or Kindle App receives the test book. Keep the Agent in control of the workflow; use the CLI for protected secret entry, delivery, and machine-readable state.

## Start

1. Run `kindle capability --json`.
2. If `data.state` is `ready`, report that setup is already complete and route document sending to `$send-to-kindle`.
3. Otherwise read [the first-run state machine](references/first-run-state-machine.md) completely and follow it without skipping a handoff.

## Completion contract

Treat these results differently:

- `provider_accepted`: the mail provider accepted the test message; setup is not complete.
- `device_confirmed`: the user found the test book on Kindle.
- `kindle capability --json` with `data.ready: true`: the capability is deployed.

After the user replies `Kindle已收到`, run:

```console
kindle --json confirm <jobId>
kindle --json capability
```

Finish only when the second command returns `data.state: "ready"`.

## Boundaries

- Never ask for the QQ password, authorization code, OTP, CAPTCHA, or QR content in chat.
- Ask the user to paste the authorization code only into the one hidden terminal prompt.
- Ask for permission immediately before any test delivery or Amazon approved-sender change.
- When browser control is unavailable, show [the QQ settings path diagram](assets/qq-manual-guide.svg) and guide one click at a time.
- End every pause with one concrete user action and the exact reply phrase that resumes the workflow.
