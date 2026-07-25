# ADR-002: 能力状态、首次配置与日常调用分层

## 状态

已通过（Approved）

## 日期

2026-07-24

## 背景

SMTP 服务商接受测试邮件，只能证明发送通道可用，不能证明 Kindle 已收到。首次配置与日常发送若共用一个大 Skill，会让每次调用重复载入浏览器、授权和 Amazon 设置上下文，也容易让不同 Agent 重跑配置。

## 决策

### 1. CLI 是唯一稳定执行层

- CLI 负责转换、校验、加密凭据、投递、任务追踪和能力状态。
- CLI 独占维护内部状态；用户与 Agent 只调用命令，不编辑底层文件。
- 同一系统用户下的多个 Agent 共用一份能力状态与系统凭据（Windows DPAPI 或 macOS 登录钥匙串）。
- 当前阶段不增加后台服务；全局 `kindle` 命令已经是稳定调用入口。

### 2. 能力状态独立于单次任务状态

能力状态为：

- `needs_setup`
- `awaiting_device_confirmation`
- `ready`
- `needs_reauth`
- `needs_repair`

首次测试任务到达 `provider_accepted` 后，能力只能进入 `awaiting_device_confirmation`。用户在真实 Kindle 或 Kindle App 找到测试书，并运行 `kindle confirm <jobId>` 后，能力才进入 `ready`。

完成判据只有一个：

```text
kindle --json capability
→ data.ready = true
```

日常任务继续使用 `provider_accepted`、`device_confirmed` 等任务状态，不把邮件提交误报为设备收到。

### 3. Skill 按上下文拆分

- `kindle-for-agents`：当前主入口，只根据 capability 选择下面一个专用 Skill。
- `kindle-setup`：首次配置、重新授权和修复；包含浏览器与人工图示引导。
- `send-to-kindle`：日常转换与发送；首先读取 capability，不重复加载配置流程。
- `kindle-bridge`：旧品牌提示词兼容路由，继续根据 capability 选择上面一个专用 Skill。

### 4. 部署边界

`scripts/bootstrap.ps1` 一次性完成：

1. 安装依赖并构建 CLI；
2. 将 `kindle` 注册为当前用户可调用命令；
3. 将四个 Skill 安装到当前用户的共享 Agent Skills 目录；
4. 输出 capability 状态。

脚本完成不等于投送能力完成。只有首次配置、测试投递和设备确认全部闭环后，才能称为“能力部署完成”。

## 后果

- 新 Agent 可先用一个快速本地命令判断是否能直接发送。
- 日常上下文不再包含 QQ/Amazon 首次配置细节。
- 用户更新授权码或 Kindle 地址时仍通过 `kindle setup` 维护，不直接操作配置文件。
- 未来可以在不改变 Skill 入口的情况下，把 CLI 底层替换为其他传输实现。
- 品牌更名为 Kindle for Agents 后继续读取 `kindle-bridge` 历史存储键，避免已有配置、凭据、任务记录和浏览器会话失效。
