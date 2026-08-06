# Kindle for Agents

Kindle for Agents 是一个本地优先、可被多个 AI Agent 共用的 Kindle 投送能力。它让 Agent 能够把本地 Markdown、TXT、HTML 或 EPUB 转换并发送到用户自己的 Kindle；邮箱授权码只保存在 Windows 当前用户的 DPAPI 保护区或 macOS 登录钥匙串中，不经过聊天或中转服务器。

> Kindle for Agents 是非官方开源项目，与 Amazon 无隶属、赞助或背书关系。Kindle 是 Amazon.com, Inc. 或其关联公司的商标。

## 问题反馈

遇到安装、配置、转换或投送问题，请通过 [Bug 报告模板](https://github.com/wangqi996/kindle-for-agents/issues/new?template=bug_report.yml) 提交；其他建议可在 [Issues](https://github.com/wangqi996/kindle-for-agents/issues) 中提出。

提交前可运行 `kindle --json doctor` 辅助定位，但请先删除输出中的邮箱地址、本机用户名、文件路径和任务编号。**不要提交 QQ 密码、邮箱授权码、Amazon 登录信息、OTP、验证码、二维码内容或其他凭据。**

## 直接交给 Agent

把下面这句话发给 Agent：

> 请克隆 https://github.com/wangqi996/kindle-for-agents ，阅读 README，并帮我部署 Kindle 投送能力。部署完成必须以 `kindle --json capability` 返回 `ready: true` 为准。

Agent 应完成一次性安装，再调用 `$kindle-setup` 连续引导 QQ 邮箱、Amazon 可信发件人、测试投递和 Kindle 实机确认。

安装前，Agent 必须先识别当前操作系统，再选择对应脚本：Windows 使用 `scripts/bootstrap.ps1`，macOS 使用 `scripts/bootstrap.sh`。不要在一个系统上尝试运行另一个系统的安装脚本。

Amazon 设置必须从 `https://www.amazon.com/hz/mycd/myx` 进入。当前版本仅支持 Amazon.com Kindle 账户，不使用已失效的 Amazon.cn Kindle 管理地址。

## 两个阶段

### 1. 首次部署与配置

在仓库目录运行对应系统的安装脚本。

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
```

macOS：

```bash
bash ./scripts/bootstrap.sh
```

脚本会为当前系统用户：

- 安装全局 `kindle` 命令；
- 安装主入口 `kindle-for-agents`、专用入口 `kindle-setup`、`send-to-kindle`，以及旧名称兼容入口 `kindle-bridge`；
- 输出当前能力状态。

如果状态不是 `ready`，让 Agent 使用 `$kindle-setup`。测试邮件被服务商接受时只表示 `provider_accepted`，还不算部署完成。用户必须在真实 Kindle 或 Kindle App 找到测试书，Agent 再执行：

```console
kindle --json confirm <jobId>
kindle --json capability
```

只有第二条命令返回：

```json
{
  "data": {
    "state": "ready",
    "ready": true
  }
}
```

才表示投送能力已经部署完成。

### 2. 日常调用

以后同一系统用户下的其他 Agent 不必重新配置，只需调用 `$send-to-kindle`，或直接运行：

```console
kindle --json capability
kindle --json send "<文档绝对路径>" --dry-run
kindle --json send "<文档绝对路径>"
```

日常发送返回 `provider_accepted` 表示邮件服务商已接收，不能自动等同于 Kindle 设备已收到。

## CLI 边界

| 命令 | 作用 |
| --- | --- |
| `kindle capability` | 快速读取本机能力是否 `ready` |
| `kindle setup` | 首次配置、重新授权和测试投递，兼容旧命令 `connect` |
| `kindle send <file>` | 转换、校验并发送文档 |
| `kindle jobs [jobId]` | 查看投递记录，兼容旧命令 `status` |
| `kindle confirm [jobId]` | 用户在设备端确认收到 |
| `kindle doctor` | 检查能力、凭据、发送通道和本地环境 |
| `kindle reset` | 清除当前用户的内部状态、加密凭据和任务历史 |

配置由 CLI 独占维护。用户和 Agent 不需要查找或编辑配置文件；所有 Agent 只通过上述命令读取和维护能力。

## 支持格式与隐私

- 输入：`.md`、`.txt`、`.html`、`.epub`
- 输出：符合 Kindle 投送要求的可重排 EPUB
- 凭据：Windows 当前用户 DPAPI 保护；macOS 登录钥匙串
- 配置：Windows `%APPDATA%\kindle-bridge`；macOS `~/Library/Application Support/kindle-bridge`
- 任务与浏览器缓存：Windows `%LOCALAPPDATA%\kindle-bridge`；macOS `~/Library/Caches/kindle-bridge`
- Amazon 登录、OTP、验证码和 QQ 安全验证：只由用户在官方页面完成
- 不使用项目方中转邮箱，不上传用户历史内容

## 本地开发

```console
npm ci
npm run build
npm test
```

支持 Node.js LTS，目标平台为 Windows 10/11 与 macOS。macOS 首次读取或写入凭据时，系统可能显示钥匙串访问提示。

项目内四个 Skill 位于 [`skills`](skills)，其中：

- [`kindle-for-agents`](skills/kindle-for-agents/SKILL.md)：根据本机能力状态分流首次配置与日常发送；
- [`kindle-setup`](skills/kindle-setup/SKILL.md)：只负责首次配置与修复；
- [`send-to-kindle`](skills/send-to-kindle/SKILL.md)：只负责日常发送；
- [`kindle-bridge`](skills/kindle-bridge/SKILL.md)：旧提示词兼容路由。

为兼容已有安装，本机内部状态仍使用历史存储键 `kindle-bridge`。品牌改名不会清除配置、加密凭据、浏览器会话或任务历史。

许可证：MIT。
