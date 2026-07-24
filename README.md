# Kindle Bridge

> 本地优先的 Kindle 内容投递工具 (Local-first Kindle Content Delivery CLI)

Kindle Bridge 允许用户通过一条简洁的命令行指令，将本地的 Markdown、TXT、HTML 或 EPUB 文件清洗整理成符合 Amazon 规范的可重排 EPUB，并安全投递到自己的 Kindle 接收邮箱。

---

## 特性

- 🔒 **本地优先**: Amazon 登录与二次验证始终由用户本人完成；SMTP 授权码仅用于本地发送，并通过 Windows 当前用户 DPAPI 保护后保存，日志中的邮箱会自动脱敏。
- 📚 **规范 EPUB 转换**: 支持 `.md`、`.txt`、`.html`、`.epub` 格式，自动生成目录 (`nav.xhtml` / `toc.ncx`)、封面及 `<dc:language>zh-CN</dc:language>` 元数据。
- 🌐 **可视化连接向导**: 支持 `kindle connect --browser` 启动持久化浏览器，协助定位 Amazon Kindle 个人文档与已认可发件人设置。
- 🛠️ **完善的诊断与追溯**: 提供 `kindle doctor` 环境排查与 `kindle status` 任务状态链分析。
- 🤖 **AI 与 Agent 友好**: 完美支持 `--json` 输出，可无缝由 AI Agent / Agent Skill 调度调用。

---

## 快速开始

### 0. 交给 Agent 使用（推荐）

项目已内置 [`skills/kindle-bridge`](skills/kindle-bridge/SKILL.md)。将整个项目交给支持 Skill 的 Agent 后，用户可以直接说：

> 帮我完成 Kindle 首次连接。

或：

> 把这篇文章发送到我的 Kindle。

Skill 会连续引导 QQ 邮箱授权、Amazon Kindle 地址与可信发件人检查、本地隐藏凭据输入、测试投递和设备端确认。用户只处理登录、安全验证、授权码隐藏粘贴和最终发送确认；授权码不会经过聊天或中转邮箱。

### 1. 安装与构建

```powershell
# 克隆仓库并安装依赖
npm install

# 编译 TypeScript
npm run build
```

### 2. 首次连接与绑定 (Connect)

运行连接命令以配置您的 Send-to-Kindle 接收邮箱及发件邮箱 SMTP 凭据：

```powershell
# 推荐：QQ 邮箱小白向导（使用系统默认浏览器进行一次性人工设置）
npx ts-node src/cli/index.ts connect --provider qq

# Agent 已完成 QQ/Amazon 浏览器导航与核对后续接
node dist/cli/index.js connect --provider qq --agent-assisted --smtp-user "user@qq.com" --kindle-email "your_name@kindle.com"

# 方式 A：命令行交互向导
npx ts-node src/cli/index.ts connect

# 方式 B：启动浏览器协助查看 Amazon 设置
npx ts-node src/cli/index.ts connect --browser

# 方式 C：预填非敏感参数，授权码仍在隐藏输入框中填写
npx ts-node src/cli/index.ts connect --kindle-email "your_name@kindle.com" --smtp-user "user@qq.com"
```

*系统会自动发送一本公版测试 EPUB 并返回 `provider_accepted` 状态。请在您的 Kindle 设备或 Kindle App 端确认试读。*

### 3. 发送文档 (Send)

```powershell
# 发送本地 Markdown 文章
npx ts-node src/cli/index.ts send .\article.md

# 指定标题与作者
npx ts-node src/cli/index.ts send .\book.md --title "示例标题" --author "王祺"

# 仅预检与转换（不实际发信）
npx ts-node src/cli/index.ts send .\draft.md --dry-run

# 机器可读 JSON 输出
npx ts-node src/cli/index.ts send .\notes.md --json
```

### 4. 查询任务状态 (Status)

```powershell
# 查看最近任务历史
npx ts-node src/cli/index.ts status

# 查看特定任务详情
npx ts-node src/cli/index.ts status job_1784712605219_pzajbl --json
```

### 5. 环境诊断 (Doctor)

```powershell
npx ts-node src/cli/index.ts doctor
```

### 6. 确认 Kindle 已收到 (Confirm)

只有用户在 Kindle 设备或 Kindle App 上确认收到后，才将任务标记为完整成功：

```powershell
node dist/cli/index.js --json confirm

# 或指定任务
node dist/cli/index.js --json confirm "job_xxx"
```

最终成功状态为 `device_confirmed`，并且 `verified` 必须为 `true`。

---

## 排错指南 (Troubleshooting)

| 错误代码 | 说明 | 解决方案 |
| :--- | :--- | :--- |
| `KINDLE_CONFIG_MISSING` | 配置或凭据缺失 | 运行 `kindle connect` 重新绑定 |
| `KINDLE_DELIVERY_FAILED` | 邮件投递失败 | 检查 SMTP 授权码是否正确，并确认发件邮箱已加入 Amazon “已认可的发件人列表” |
| `KINDLE_EPUB_INVALID` | EPUB 结构不合规 | 检视 Markdown/HTML 中是否包含损坏或无法解析的非标准标签 |

---

## 卸载与清除数据

如需完全清除本地配置与凭据：

- 配置文件目录: `%APPDATA%\kindle-bridge\`
- 任务与浏览器 Profile: `%LOCALAPPDATA%\kindle-bridge\`
