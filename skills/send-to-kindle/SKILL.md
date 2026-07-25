---
name: send-to-kindle
description: Convert and send a local Markdown, HTML, text, or EPUB document through an already configured Kindle for Agents capability. Use when the user asks an Agent to send, push, deliver, or test a local article or book on Kindle after setup.
---

# Send to Kindle

Keep daily use short. Do not load or repeat first-run setup unless the capability is not ready.

## Workflow

1. Run `kindle --json capability`.
2. If `data.ready` is false, state the returned reason and route to `$kindle-setup`. Do not reconstruct setup inside this skill.
3. Resolve the exact local input file. If the path is ambiguous, ask only for the file.
4. Run a local conversion check:

   ```console
   kindle --json send "<absolute-file-path>" --dry-run
   ```

5. Report the title and destination mask, then ask the user to approve the real send.
6. After approval, run:

   ```console
   kindle --json send "<absolute-file-path>"
   ```

7. Report the returned state precisely:

   - `provider_accepted`: submitted successfully; Kindle arrival is still pending.
   - `device_confirmed`: the user later confirmed arrival.
   - `failed`: report the error and a single next action.

If the user confirms arrival, run `kindle --json confirm <jobId>`. Never claim the device received a document solely from `provider_accepted`.

## Boundaries

- Never expose or request stored credentials.
- Never rerun setup when `data.ready` is true.
- Ask for approval immediately before the real send because it sends user content externally.
- End every pause with the exact next action and expected reply.
