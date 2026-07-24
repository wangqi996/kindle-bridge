# CLI contract

## Locate and prepare the CLI

Use `scripts/run-kindle-bridge.ps1` from the repository. It resolves the repository root and executes `dist/cli/index.js`.

If `dist/cli/index.js` is missing:

```powershell
npm install
npm run build
```

Do not install packages or run a build without telling the user when this changes the local project.

## Commands

Diagnose:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json doctor
```

First connection after browser setup:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 connect --provider qq --agent-assisted --test-send-confirmed --smtp-user "<QQ address>" --kindle-email "<Kindle address>"
```

Dry run:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json send "<file>" --dry-run
```

Send:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json send "<file>" --title "<title>" --author "<author>"
```

Inspect:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json status
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json status "<jobId>"
```

Confirm device receipt:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json confirm "<jobId>"
```

## Status semantics

| Status | Meaning | Claim success? |
|---|---|---|
| `validated` | EPUB structure passed local checks. | No |
| `provider_accepted` | SMTP provider accepted the email. | No |
| `amazon_accepted` | Amazon accepted the document when evidence is available. | No |
| `amazon_rejected` | Amazon rejected the document. | No |
| `device_confirmed` + `verified: true` | User confirmed receipt on Kindle. | Yes |
| `failed` | The current stage failed. | No |

Never convert `provider_accepted` into “Kindle received”.

## Secret handling

Run `connect` in an interactive terminal. Do not pipe stdin, automate keystrokes, read the clipboard, or include the authorization code in command arguments.

In Agent-assisted mode, obtain explicit test-send approval in chat before adding `--test-send-confirmed`. With this flag the terminal asks only for the hidden authorization code and does not ask for a second `yes`.

Passing the QQ and Kindle addresses as command arguments is allowed because they are required non-secret routing values, but keep them out of chat and mask them in user-facing reports.

Credentials are saved only after a real SMTP test succeeds and are protected with Windows current-user DPAPI.

## Error routing

- `KINDLE_CONFIG_MISSING`: start First connection.
- `KINDLE_DELIVERY_FAILED`: verify QQ authorization code and Amazon approved sender.
- `KINDLE_EPUB_INVALID`: fix the input document or conversion before sending.
- `KINDLE_AUTH_EXPIRED`: generate a new QQ authorization code.
- `KINDLE_TIMEOUT`: inspect status before retrying; do not send duplicates blindly.

## Reset for a fresh test

After the user explicitly agrees to clear local Kindle Bridge state:

```powershell
.\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json reset --yes
```

This removes local configuration, Windows-protected credentials, and job history. It does not delete project files or revoke the authorization code on QQ servers.
