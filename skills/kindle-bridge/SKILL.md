---
name: kindle-bridge
description: Guide a non-technical user through private, local-first Kindle delivery with the bundled Kindle Bridge CLI. Use when the user asks to connect QQ Mail or Amazon Send-to-Kindle, find a Kindle receiving address, approve a sender, send Markdown/TXT/HTML/EPUB files to Kindle, diagnose delivery, or confirm that a Kindle device received a document.
---

# Kindle Bridge

Use the bundled CLI and, when available, the user's existing logged-in browser to complete delivery without a relay mailbox. Keep the workflow continuous and make the user perform only login, security verification, secret paste, and final send confirmation.

## Enforce the handoff contract

At every pause:

1. State why the workflow paused.
2. Give exactly one user action.
3. Give the exact phrase the user must reply with.

Never end with only “完成后告诉我” or “请继续操作”. Never leave the user waiting without a visible next action.

Use this template:

```text
当前停在：[页面或安全边界]。
现在只做一步：[唯一动作]。
完成后回来回复：[固定回复短语]
```

Resume immediately from the recorded stage when the user returns. Do not restart completed steps.

## Protect secrets and privacy

- Never ask the user to paste a QQ authorization code, password, OTP, or CAPTCHA answer into chat.
- Never read, print, log, save, or pass the authorization code through browser automation, command flags, environment variables, or temporary files.
- Make the user paste the authorization code only into the CLI hidden input.
- Do not repeat full QQ or Kindle addresses in chat. Read them from the page when permitted and pass them directly to the local CLI.
- Keep documents local until the user confirms the final send. Do not use a relay mailbox or upload documents to an intermediary service.
- Ask for action-time confirmation before enabling SMTP, adding an approved sender, or sending a test/document.

## Choose the workflow

Run the bundled launcher from the repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json doctor
```

Interpret the result:

- If credentials and SMTP checks pass, continue to **Send a document**.
- If credentials are missing or invalid, continue to **First connection**.
- If the CLI cannot be located or built, follow [CLI contract](references/cli-contract.md).

## First connection

Read [First-run state machine](references/first-run-state-machine.md) before interacting with QQ Mail or Amazon.

Follow these stages in order:

1. Open QQ Mail in an available browser that can use the user's existing session.
2. If login is required, pause with the reply phrase `QQ已登录`.
3. Navigate through the complete QQ hierarchy: upper-right `设置` → lower-left `账号与安全` → separate-page `安全设置` → `POP3/IMAP/SMTP/Exchange/CardDAV 服务`. When browser control is unavailable, show the diagram in the state-machine reference and guide one click at a time.
4. Let the user handle security verification and copy the complete 16-character code. Pause with `授权码已复制`. Tell the user to keep it in the clipboard and not paste it yet.
5. Do not start the CLI yet. Open Amazon Manage Your Content and Devices.
6. If login is required, pause with `Amazon已登录`.
7. Read the Kindle receiving address and check whether the QQ sender is already approved.
8. If approval is missing, ask before adding it. Do not submit the account change without confirmation.
9. Explain that pasting the authorization code will immediately send one test EPUB. Obtain the chat reply `允许发送测试书`.
10. Only after QQ, Amazon, and test approval are complete, start an interactive local terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 connect --provider qq --agent-assisted --test-send-confirmed --smtp-user "<QQ address>" --kindle-email "<Kindle address>"
```

11. Tell the user to paste the copied code into the single hidden prompt and reply `授权码已粘贴`. Do not ask for `yes`; the Agent already obtained approval.
12. Run `--json status` and `--json doctor`. Treat `provider_accepted` only as server acceptance, not device success.
13. Tell the user to sync the Kindle and find `Kindle Bridge 首次连接测试书`. Require either `Kindle已收到` or `Kindle未收到`.
14. Only after `Kindle已收到`, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json confirm
```

Declare the connection successful only when the result is `device_confirmed` with `verified: true`.

## Send a document

1. Resolve the exact local input file. Support Markdown, TXT, HTML, and EPUB.
2. Run a dry run first when the document is new, generated, or structurally uncertain:

```powershell
powershell -ExecutionPolicy Bypass -File .\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json send "<file>" --dry-run
```

3. Report conversion errors before asking to send.
4. Ask for action-time confirmation naming the document and destination Kindle account in masked form.
5. Send only after confirmation:

```powershell
powershell -ExecutionPolicy Bypass -File .\skills\kindle-bridge\scripts\run-kindle-bridge.ps1 --json send "<file>" --title "<title>" --author "<author>"
```

6. Treat `provider_accepted` as pending device confirmation.
7. Ask the user to sync Kindle and reply `Kindle已收到` or `Kindle未收到`.
8. On receipt, run `--json confirm [jobId]`. Report success only after `device_confirmed`.

## Recover without breaking continuity

- If a login expires, return to that login stage and reuse its fixed reply phrase.
- If the authorization code is not 16 alphanumeric characters, do not save or send. Return to `授权码已复制`.
- If SMTP rejects the message, keep credentials unmodified and guide the user back to QQ authorization-code generation.
- If Amazon rejects or the device does not receive the document, inspect the approved sender list and Amazon email notifications before regenerating credentials.
- If browser control is unavailable, open the official page with the system browser and give one click target at a time. Preserve the same fixed reply phrases.
- Keep the Agent as the workflow controller. In Agent-assisted mode, use the terminal only for the single hidden authorization-code input and progress output.

Use [CLI contract](references/cli-contract.md) for command outputs and status semantics.
