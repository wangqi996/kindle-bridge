# First-run state machine

Use these stages exactly. Preserve completed state across user replies.

Never start the CLI before `QQ_CODE`, `AMAZON_CHECK`, and `TEST_APPROVAL` are all complete. The authorization code is copied once and pasted once.

| Stage | Agent action | User-only action | Required reply |
|---|---|---|---|
| `QQ_OPEN` | Open `https://mail.qq.com/` in the browser with the user's existing session. | Sign in if required. | `QQ已登录` |
| `QQ_SETTINGS` | From QQ Mail, locate `设置` in the upper-right corner. Then locate `账号与安全` near the lower-left of the settings sidebar. | Click the named target when browser control is unavailable. | `已进入账号与安全` |
| `QQ_SECURITY` | On the separate 账号与安全 page, select `安全设置`. Then locate `POP3/IMAP/SMTP/Exchange/CardDAV 服务`. | Complete identity verification if prompted. | `QQ安全验证已完成` |
| `QQ_CODE` | Stop at 生成授权码. Do not read the code or clipboard. | Generate the code and click copy. Keep it in the clipboard; do not paste yet. | `授权码已复制` |
| `AMAZON_OPEN` | Open Manage Your Content and Devices → Preferences → Personal Document Settings. | Sign in if required. | `Amazon已登录` |
| `AMAZON_CHECK` | Read the `@kindle.com` address and check the Approved Personal Document E-mail List. | None when already approved. | No pause |
| `AMAZON_APPROVE` | Explain the exact sender addition and ask for confirmation before submitting. | Confirm the change or complete Amazon verification. | `允许添加可信发件人` / `可信发件人已添加` |
| `TEST_APPROVAL` | Explain that the next terminal paste will immediately send one test EPUB from QQ to Kindle. | Approve the test in chat. | `允许发送测试书` |
| `CLI_SECRET` | Start `connect --provider qq --agent-assisted --test-send-confirmed` in an interactive local terminal. | Paste the previously copied code into the single hidden prompt and press Enter. | `授权码已粘贴` |
| `PROVIDER_CHECK` | Run status and doctor. Confirm `provider_accepted`. | None. | No pause |
| `DEVICE_CHECK` | Ask the user to sync Kindle and find the test title. | Check the physical device or Kindle App. | `Kindle已收到` / `Kindle未收到` |
| `COMPLETE` | Run `confirm`; verify `device_confirmed` and `verified: true`. | None. | No pause |

## Browser rules

Prefer a browser surface that can use the user's existing logged-in session. Follow that browser's own control skill and confirmation rules.

Do not assume a specific browser implementation:

1. Detect whether the current Agent can control an existing user browser session.
2. If yes, navigate and inspect visible settings directly.
3. If no, open the official page in the system browser and show the user [QQ manual path diagram](../assets/qq-manual-guide.svg).
4. Guide one visible click target at a time.
5. Never ask the user to “scroll and find the service” before they have entered `账号与安全 → 安全设置`.

Authentication boundaries:

- Ask the user to sign in; do not request credentials in chat.
- Let the user handle OTP, CAPTCHA, QR scan, and security verification.
- After login, require the exact resume phrase and continue navigation automatically.

## QQ Mail details

Use the full current hierarchy:

`QQ 邮箱首页右上角“设置” → 设置页左下“账号与安全” → 新页面“安全设置” → POP3/IMAP/SMTP/Exchange/CardDAV 服务`

`账号与安全` opens another page. On that page, `账号设置` and `安全设置` are separate sections. The protocol service is under `安全设置`, not the general account settings content.

The mail service section must show `POP3/IMAP/SMTP/Exchange/CardDAV 服务（已开启）`. If it is off, explain the account change and ask for confirmation before enabling it.

The authorization code is 16 alphanumeric characters and has no fixed prefix or suffix. Do not inspect it. After copying, explicitly say:

```text
授权码已经复制。先保留在剪贴板，不要发到聊天，也暂时不要粘贴。
接下来先完成 Amazon Kindle 地址和可信发件人检查；全部核对后只会出现一次本地隐藏输入框。
```

## Amazon details

Use:

`Manage Your Content and Devices → Preferences → Personal Document Settings`

Read:

- `Send-to-Kindle E-Mail Settings` for the receiving address.
- `Approved Personal Document E-mail List` for the QQ sender.

If the sender is already present, skip the account-change step. If missing, ask at action time before adding it.

## Agent and terminal ownership

Keep the Agent as the workflow controller. Use the terminal only for:

1. Hidden authorization-code input.
2. Conversion and sending progress.
3. Machine-readable status.

Do not let the Agent and terminal ask the same question. In Agent-assisted mode:

- Obtain test-send approval in chat before launching the terminal.
- Pass `--test-send-confirmed`.
- Let the terminal show exactly one authorization-code prompt.
- Do not ask the user to type `yes` after pasting the code.

## Handoff messages

QQ settings:

```text
当前停在 QQ 邮箱首页。
现在只做一步：点击界面右上角的“设置”。
完成后回来回复：已打开QQ设置
```

Account and security:

```text
当前已经进入邮箱设置页。
现在只做一步：点击左侧靠下的“账号与安全”；它会打开新的账号安全页面。
完成后回来回复：已进入账号与安全
```

Security settings:

```text
当前在“账号与安全”页面，但邮箱服务不在普通账号设置里。
现在只做一步：进入“安全设置”，再找到“POP3/IMAP/SMTP/Exchange/CardDAV 服务”。
完成后回来回复：已找到邮箱服务
```

Authorization code:

```text
当前已经停在“生成授权码”，授权码不能经过聊天。
现在只做一步：完成安全验证，生成授权码并点击复制；复制后先不要粘贴。
完成后回来回复：授权码已复制
```

Test approval:

```text
QQ 和 Amazon 设置已经全部核对。下一步粘贴授权码后，程序会立即发送一本测试 EPUB，不会再询问 yes。
现在只做一步：确认是否允许发送测试书。
允许则回复：允许发送测试书
```

Hidden paste:

```text
本地安全输入窗口已经打开，这是整个流程唯一一次粘贴授权码。
现在只做一步：在授权码提示后按 Ctrl+V，再按 Enter；输入内容不会显示。
完成后回来回复：授权码已粘贴
```

Device confirmation:

```text
邮件服务器已经接受测试 EPUB，但还不能代表 Kindle 已收到。
现在只做一步：打开 Kindle 或 Kindle App，点击同步并查找《Kindle Bridge 首次连接测试书》。
完成后回来回复：Kindle已收到；没有收到则回复：Kindle未收到
```
