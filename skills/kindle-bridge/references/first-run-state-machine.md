# First-run state machine

Use these stages exactly. Preserve completed state across user replies.

| Stage | Agent action | User-only action | Required reply |
|---|---|---|---|
| `QQ_OPEN` | Open `https://mail.qq.com/` in the browser with the user's existing session. | Sign in if required. | `QQ已登录` |
| `QQ_SECURITY` | Navigate to 设置 → 账号与安全 → 安全设置 → POP3/IMAP/SMTP/Exchange/CardDAV 服务. | Complete identity verification if prompted. | `QQ安全验证已完成` |
| `QQ_CODE` | Stop at 生成授权码. Do not read the code or clipboard. | Generate the code and click copy. | `授权码已复制` |
| `AMAZON_OPEN` | Open Manage Your Content and Devices → Preferences → Personal Document Settings. | Sign in if required. | `Amazon已登录` |
| `AMAZON_CHECK` | Read the `@kindle.com` address and check the Approved Personal Document E-mail List. | None when already approved. | No pause |
| `AMAZON_APPROVE` | Explain the exact sender addition and ask for confirmation before submitting. | Confirm the change or complete Amazon verification. | `允许添加可信发件人` / `可信发件人已添加` |
| `CLI_SECRET` | Start `connect --provider qq --agent-assisted` in an interactive local terminal. | Paste into the hidden prompt and press Enter. | `授权码已粘贴` |
| `CLI_SEND` | Explain that the test EPUB will be sent from QQ to Kindle. | Enter `yes` and press Enter. | `测试发送已确认` |
| `PROVIDER_CHECK` | Run status and doctor. Confirm `provider_accepted`. | None. | No pause |
| `DEVICE_CHECK` | Ask the user to sync Kindle and find the test title. | Check the physical device or Kindle App. | `Kindle已收到` / `Kindle未收到` |
| `COMPLETE` | Run `confirm`; verify `device_confirmed` and `verified: true`. | None. | No pause |

## Browser rules

Prefer a browser surface that can use the user's existing logged-in session. Follow that browser's own control skill and confirmation rules.

Do not assume a specific browser implementation:

1. Detect whether the current Agent can control an existing user browser session.
2. If yes, navigate and inspect visible settings directly.
3. If no, open the official page in the system browser and guide one click target at a time.
4. Never ask the user to search through an entire settings page without naming the next visible target.

Authentication boundaries:

- Ask the user to sign in; do not request credentials in chat.
- Let the user handle OTP, CAPTCHA, QR scan, and security verification.
- After login, require the exact resume phrase and continue navigation automatically.

## QQ Mail details

Use the current QQ Mail interface labels rather than relying on a permanent deep link. If the settings sidebar opens a separate account-security page, follow it and select `安全设置`.

The mail service section must show `POP3/IMAP/SMTP/Exchange/CardDAV 服务（已开启）`. If it is off, explain the account change and ask for confirmation before enabling it.

The authorization code is 16 alphanumeric characters and has no fixed prefix or suffix. Do not inspect it. Let the CLI validate it after hidden paste.

## Amazon details

Use:

`Manage Your Content and Devices → Preferences → Personal Document Settings`

Read:

- `Send-to-Kindle E-Mail Settings` for the receiving address.
- `Approved Personal Document E-mail List` for the QQ sender.

If the sender is already present, skip the account-change step. If missing, ask at action time before adding it.

## Handoff messages

Use one action per message.

QQ login:

```text
当前停在 QQ 邮箱登录页，因为登录必须由你本人完成。
现在只做一步：完成 QQ 邮箱登录。
完成后回来回复：QQ已登录
```

Authorization code:

```text
当前已经停在“生成授权码”，授权码不能经过聊天。
现在只做一步：完成安全验证，生成授权码并点击复制。
完成后回来回复：授权码已复制
```

Hidden paste:

```text
本地安全输入窗口已经打开。
现在只做一步：在授权码提示后按 Ctrl+V，再按 Enter；输入内容不会显示。
完成后回来回复：授权码已粘贴
```

Device confirmation:

```text
邮件服务器已经接受测试 EPUB，但还不能代表 Kindle 已收到。
现在只做一步：打开 Kindle 或 Kindle App，点击同步并查找《Kindle Bridge 首次连接测试书》。
完成后回来回复：Kindle已收到；没有收到则回复：Kindle未收到
```
