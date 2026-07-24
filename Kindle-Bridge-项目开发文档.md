# Kindle Bridge 项目开发文档

> 文档用途：将本文件完整交给开发助手，作为第一阶段的实施依据。  
> 项目阶段：MVP / 可行性验证  
> 首要原则：先跑通真实设备闭环，再封装 Skill（不开发 MCP）。
>
> **历史说明（2026-07-24）**：本文保留最初 MVP 设计。当前架构以 `docs/adr/ADR-002-capability-and-skill-layers.md` 和 README 为准，已经拆分首次配置与日常调用，并以 `kindle capability` 的 `ready: true` 作为能力部署完成判据。

## 1. 项目定义

Kindle Bridge 是一个本地优先的 Kindle 内容投递工具。用户完成一次 Amazon/Kindle 绑定后，可以通过一条命令把本地内容整理成适合 Kindle 阅读的文件并发送到自己的 Kindle。

第一阶段交付物是 **CLI**，后续增加 **Agent Skill**，不开发 MCP Server。

- CLI：真正执行读取、转换、发送和状态返回。
- Skill：后续增加，告诉 AI 何时以及怎样调用 CLI。

项目最终体验：

```text
首次：kindle connect → 用户登录 Amazon → 程序完成绑定与测试发送
日常：kindle send <文件> → Kindle 收到内容
```

## 2. 背景与核心问题

Amazon 的邮件投递方式要求：

1. 用户拥有个人 Send-to-Kindle 接收邮箱。
2. 发件邮箱被加入 Kindle 的可信发件人列表。
3. 首次绑定可能遇到 Amazon 登录、二次验证或验证码。

这些安全步骤不能绕过。产品需要把它们压缩成一次性初始化：用户只处理登录和必须由本人确认的安全验证，其余步骤由程序引导或自动完成。

Amazon 官方资料确认 EPUB 可以发送到 Send-to-Kindle 邮箱：  
<https://kdp.amazon.com/en_US/help/topic/G200641240/>

当前没有发现面向普通开发者、可直接上传个人文档的公开 Send to Kindle API。因此发送层优先考虑邮件通道，浏览器自动化仅承担首次绑定或故障恢复。

## 3. MVP 目标

MVP 必须完成以下真实链路：

```text
本地 Markdown/EPUB
→ 检查并生成有效 EPUB
→ 发送到用户的 Send-to-Kindle 邮箱
→ 获得发送结果或 Amazon 回执
→ 用户在真实 Kindle 设备或 Kindle App 中确认出现
```

### 3.1 必须实现

- Windows 优先运行。
- 提供 `connect`、`send`、`status`、`doctor` 四个命令。
- 首次连接时不收集、不保存 Amazon 密码。
- 用户亲自处理登录、二次验证和验证码。
- 支持 `.md`、`.txt`、`.html`、`.epub`。
- Markdown、TXT、HTML 可以转换成可重排 EPUB。
- EPUB 在发送前必须完成基础结构验证。
- 支持人类可读输出和 `--json` 机器输出。
- 清楚区分“文件已发送”“Amazon 已接受”“设备端已确认”。
- 日志不得记录邮箱授权令牌、SMTP 密码或完整文档内容。

### 3.2 暂不实现

- 不做 Kindle 标注回流。
- 不做阅读状态同步。
- 不做公共网页的批量抓取。
- 不做付费、多租户后台和团队管理。
- 不绕过验证码、二次验证或 Amazon 风控。
- 不把“邮件投递成功”表述为“Kindle 已收到”。
- 不开发 MCP Server，仅开发 Agent Skill。

## 4. 推荐技术方案

### 4.1 技术栈

- Node.js 20 LTS 或更高版本。
- TypeScript，开启严格模式。
- CLI 框架：选择维护活跃、支持子命令和自动帮助的库。
- 浏览器连接向导：Playwright，使用独立、持久化的浏览器配置目录。
- 配置校验：使用 Schema 校验库。
- 凭据保存：Windows Credential Manager；不得把令牌明文写入 JSON。
- EPUB：优先选择可离线运行、能控制目录与元数据的生成方案。
- 邮件：抽象为 Transport 接口，首版至少实现一种真实可用的邮件传输方式。

依赖库的具体选择由开发助手在实施时核对当前维护状态，不要采用多年未维护的 EPUB 库。

### 4.2 总体架构

```text
CLI
├── Connect Wizard
│   ├── Amazon 登录与用户确认
│   ├── Kindle 接收邮箱发现/录入
│   └── 可信发件地址绑定与测试
├── Input Pipeline
│   ├── Markdown
│   ├── TXT
│   ├── HTML
│   └── EPUB passthrough
├── EPUB Builder / Validator
├── Delivery Transport
│   ├── Email（主路径）
│   └── Web Upload（可选故障回退，不作为日常主路径）
├── Receipt / Status Tracker
└── Local Config & Credential Store
```

核心模块不得直接依赖 CLI 参数解析，以便未来 MCP Server 和桌面界面复用。

## 5. CLI 设计

项目临时命令名使用 `kindle`，包名可使用 `kindle-bridge`。

### 5.1 首次连接

```powershell
kindle connect
```

预期流程：

1. 检查本机运行条件。
2. 创建独立的本地配置目录。
3. 启动连接向导。
4. 用户在 Amazon 页面亲自登录。
5. 程序尝试定位 Kindle 个人文档设置。
6. 自动读取或请用户确认 Kindle 接收邮箱。
7. 添加/确认可信发件邮箱。
8. 将必要的发送凭据安全保存到系统凭据库。
9. 生成一本无版权风险的测试 EPUB。
10. 发送测试文件并显示各阶段状态。
11. 请用户确认设备端是否出现；将结果记为本地验证记录。

如果 Amazon 页面发生变化，连接向导必须降级为逐步引导，不能无限重试或假装成功。

### 5.2 发送文件

```powershell
kindle send .\article.md
kindle send .\book.epub --title "示例标题"
kindle send .\notes\weekly.md --author "王祺" --json
```

建议参数：

```text
--title <标题>
--author <作者>
--cover <图片路径>
--keep-epub
--dry-run
--json
--timeout <秒>
```

`--dry-run` 只完成读取、转换、验证和预览，不发送邮件。

### 5.3 查看状态

```powershell
kindle status
kindle status <job-id> --json
```

状态模型：

```text
created
converted
validated
submitted
provider_accepted
amazon_accepted
amazon_rejected
device_confirmed
failed
```

不能自动证明的状态必须保持未知。例如没有收到 Amazon 回执时，只能显示 `provider_accepted`，不能提升为 `amazon_accepted`。

### 5.4 环境诊断

```powershell
kindle doctor
```

至少检查：

- 配置文件是否存在且 Schema 有效。
- 凭据是否能从系统凭据库读取。
- Kindle 接收邮箱格式是否合理。
- 邮件传输是否可用。
- EPUB 生成与临时目录是否可写。
- 浏览器连接向导是否可启动。
- 最近一次真实测试的时间和结果。

## 6. 首次绑定方案

### 6.1 产品原则

- 不要求用户阅读 Amazon 设置教程。
- 不要求用户手工复制多个地址；程序能识别时自动填充。
- 密码、二次验证码和验证码始终由用户本人输入。
- 不把 Amazon Cookie 导出到远端服务器。
- 浏览器自动化只用于一次性绑定与后续修复。

### 6.2 发件通道

实现时在以下方案中选定一个作为 MVP 主路径，并将选择写入 ADR：

#### 方案 A：用户邮箱 OAuth

- 用户授权自己的邮箱发送附件。
- 发件人与用户身份一致，隐私边界清楚。
- 初始化步骤较多，但适合本地优先版本。

#### 方案 B：项目邮件中转服务

- 每个用户分配唯一随机别名，例如 `k-<随机令牌>@send.example.com`。
- 用户只需把该地址加入 Kindle 可信列表一次。
- 日常体验最好，但需要服务器、滥用防护、隐私说明和运营成本。

禁止所有用户共享同一个公开发件地址。中转方案必须具备：用户级别名、撤销、频率限制、文件大小限制、审计记录和短期文件删除策略。

### 6.3 推荐阶段选择

- 个人可用 MVP：优先方案 A，减少服务端建设。
- 面向普通用户的产品版：完成真实需求验证后升级为方案 B。
- 若邮件授权暂时阻塞，可以用持久浏览器会话完成网页上传，仅作为验证手段，不得把它误认为最终稳定架构。

## 7. 内容处理规则

### 7.1 默认行为

- 保留原标题、章节层级、段落、列表、链接和图片说明。
- 清除脚本、追踪元素和危险 HTML。
- 图片本地化并限制尺寸。
- 生成封面、目录、语言、作者等基础元数据。
- 中文默认语言标记为 `zh-CN`。
- 默认不让 AI 改写原文。

### 7.2 AI 能力作为可选层

后续可加入：

```powershell
kindle send article.md --ai-clean
kindle send folder\ --ai-anthology
kindle send article.md --ai-summary
```

AI 处理必须：

- 明确区分原文、摘要和 AI 补充内容。
- 默认保留来源和原作者信息。
- 在发送前提供预览或 `--dry-run`。
- 不默认抓取或打包用户无权复制的付费内容。

发送功能不应强依赖任何一家 AI 模型。AI Provider 应为可插拔接口。

## 8. 本地数据与安全

推荐位置：

```text
%APPDATA%\kindle-bridge\config.json
%LOCALAPPDATA%\kindle-bridge\jobs\
%LOCALAPPDATA%\kindle-bridge\browser-profile\
Windows Credential Manager：邮箱 OAuth/SMTP 凭据
```

安全要求：

- Amazon 密码永不保存。
- 邮件访问令牌和 SMTP 密码不写入配置文件或日志。
- 日志中的接收邮箱默认脱敏，例如 `w***@kindle.com`。
- 临时文档成功发送后按策略删除。
- `--debug` 也不得输出凭据、Cookie 或完整邮件正文。
- 浏览器配置目录设置为当前用户专用权限。
- 所有远端请求设置超时、重试上限和可诊断错误。

## 9. 配置结构示例

以下内容仅为非敏感配置示例：

```json
{
  "version": 1,
  "amazonRegion": "amazon.com",
  "kindleAddressMasked": "w***@kindle.com",
  "transport": "user-oauth",
  "defaultAuthor": "王祺",
  "language": "zh-CN",
  "keepGeneratedEpub": false,
  "connectedAt": "2026-07-22T00:00:00+08:00",
  "lastVerifiedAt": null
}
```

完整 Kindle 邮箱如需保存，应使用系统凭据库或操作系统级加密，不要放入普通 JSON。

## 10. 机器可读输出

成功示例：

```json
{
  "ok": true,
  "jobId": "job_01",
  "input": "article.md",
  "output": "article.epub",
  "status": "provider_accepted",
  "verified": false,
  "message": "邮件服务已接受，尚未确认 Amazon 或设备端接收"
}
```

失败示例：

```json
{
  "ok": false,
  "jobId": "job_01",
  "status": "failed",
  "error": {
    "code": "KINDLE_TRANSPORT_AUTH_EXPIRED",
    "message": "邮箱授权已失效，请运行 kindle connect --repair"
  }
}
```

退出码建议：

```text
0  命令按定义完成
2  参数或输入错误
3  配置未完成
4  内容转换失败
5  EPUB 验证失败
6  发送失败
7  授权失效
8  外部服务超时
```

## 11. 错误处理

所有错误必须包含：

- 稳定的错误代码。
- 人类可读说明。
- 用户下一步应该执行的命令。
- 底层错误仅写入脱敏调试日志。

重点场景：

- Amazon 登录过期。
- 页面结构变化，元素无法定位。
- 用户未完成可信邮箱绑定。
- 邮箱 OAuth/SMTP 授权失效。
- EPUB 不合法或图片缺失。
- Amazon 回信拒绝转换。
- 文件超过当前通道限制。
- 同一文件重复发送。
- 网络中断但邮件服务可能已经接受，避免盲目重发。

需要为发送操作生成幂等键，防止超时重试造成 Kindle 中出现多份重复内容。

## 12. 测试要求

### 12.1 自动化测试

- CLI 参数和退出码单元测试。
- Markdown/TXT/HTML 转换测试。
- EPUB 结构、目录和元数据测试。
- 配置迁移和损坏配置测试。
- Transport 使用假邮件服务测试成功、拒绝、超时和不确定状态。
- 日志脱敏测试。
- 重试与幂等测试。

测试夹具只能使用自有文本或公版内容。

### 12.2 真实验收

必须至少完成一次真实设备闭环，记录但不泄露以下证据：

1. 测试源文件哈希。
2. 生成 EPUB 的验证结果。
3. 邮件服务接受时间。
4. Amazon 回执结果（如可获得）。
5. Kindle 设备或 App 端出现时间，由用户确认。

未经第 5 步，不得宣布“端到端成功”；最多只能宣布“发送链路已提交”或“Amazon 已接受”。

## 13. MVP 验收标准

以下条件必须全部满足：

- `kindle connect` 能在一台实际 Windows 电脑上完成配置。
- 配置过程不保存 Amazon 密码。
- `kindle send sample.md` 能生成合法 EPUB。
- 文件由真实发送通道提交给用户的 Kindle 邮箱。
- CLI 能返回准确、不夸大的状态。
- 用户在真实 Kindle 或 Kindle App 中确认测试书出现。
- 第二次发送不需要重新打开 Amazon 设置页面。
- `kindle send sample.md --json` 可供 AI 稳定解析。
- `kindle doctor` 能识别至少授权失效、配置缺失和发送通道不可用。
- README 包含安装、连接、发送、排错和卸载说明。

## 14. 开发阶段

### Phase 0：环境与风险验证

- 核对 Amazon 当前设置入口和页面行为。
- 核对选定邮件通道的授权与附件能力。
- 选择并验证 EPUB 生成方案。
- 编写 ADR：发送通道选择、凭据保存方式、浏览器自动化边界。

### Phase 1：CLI 骨架与离线转换

- 完成命令结构、配置、日志和错误模型。
- 跑通 Markdown/TXT/HTML → EPUB。
- 完成 EPUB 验证和 `--dry-run`。

### Phase 2：连接与真实发送

- 实现 `connect`。
- 实现邮件 Transport。
- 实现测试书发送。
- 完成真实 Kindle 验收。

### Phase 3：可靠性

- 状态记录、回执解析、幂等、重试和 `doctor`。
- 授权修复流程。
- 打包 Windows 安装方式。

### Phase 4：AI Skill 接入

- 创建 Kindle Agent Skill，让 AI 能通过命令行与 `--json` 格式精准调用与调度已验证的 CLI。
- （注：按最新规划，本项目仅开发 Agent Skill，不做 MCP Server。）

## 15. Skill 设计哲学：能力解耦与宿主自主

Skill 的核心目标是**封装底层能力与工具标准**，绝不干涉或强加宿主 Personal Agent（如 Hermes、龙虾、AutoGPT 等）的“人格、话术与对话控制权”。

### 15.1 设计三原则

1. **能力纯粹性 (Capability Focus)**：  
   Skill 只提供 CLI 命令映射、结构化步骤、错误码字典与离线转换能力，不固化任何回复话术模板。
2. **表达权与人格解耦 (No Forced Personality)**：  
   不规定 Agent 的说话口吻，不抢夺角色控制权。宿主 Agent 保持原有的人设与上下文，自行决定如何向用户表达。
3. **流程自主裁量 (Agent-Led Workflow)**：  
   由宿主 Agent 自主决定**何时**引导用户、**是否**使用浏览器辅助 (`kindle connect --browser`)。Skill 仅提供参考步骤数据与可能需要的帮助信息。

---

### 15.2 交付给宿主 Agent 的能力字典与参考元数据

#### 1. 命令行能力映射 (CLI Capabilities)
- **环境与健康诊断**：`kindle doctor --json`（包含配置文件、存储权限、凭据库状态及 Playwright Chromium 浏览器引擎前置就绪检查）
- **查看发送任务**：`kindle status [job_id] --json`
- **文档转换与投递**：`kindle send <path> [--title <title>] [--dry-run] --json`
- **凭据绑定与可视化向导**：`kindle connect [--browser] [--kindle-email ...] [--smtp-user ...] [--smtp-pass ...]`

#### 2. 绑定所需的 3 项基础要素 (Reference Prerequisites)
当宿主 Agent 需要引导用户时，可参考以下 3 项必要信息：
- 🔹 **Kindle 接收邮箱** (如 `xxxx@kindle.com`)
- 🔹 **Amazon 已认可发件人邮箱** (需要在 Amazon 个人文档设置中添加)
- 🔹 **发件邮箱 SMTP 授权码 / 密码**

#### 3. 可选辅助指引知识库 (Optional Knowledge Base for Agent)
宿主 Agent 可根据用户需求自主选用以下参考知识：
- **浏览器协助**：调用 `kindle connect --browser` 可打开浏览器导航至 Amazon 个人文档设置页 (`https://www.amazon.com/hz/mycd/myftys`)。
- **授权码位置**：
  - QQ 邮箱：`mail.qq.com` -> 设置 -> 账户 -> POP3/SMTP 服务。
  - 163 邮箱：`mail.163.com` -> 设置 -> POP3/SMTP/IMAP -> 新增授权密码。
  - Gmail：Google 账号安全中心 -> 应用专用密码。

#### 4. 机器状态与边界规范
- 当 CLI 返回 `provider_accepted` 时，Skill 告知宿主 Agent 该状态代表“邮件通道发送成功”，宿主 Agent 应据此进行客观说明，不误导用户为“Kindle 硬件已确认收到”。
- 配置或授权缺失时，CLI 返回 `unconfigured` 错误码，宿主 Agent 可自主决定是否触发配置引导。

## 16. MCP 规划说明（已取消）

根据最新需求调整，本项目取消 MCP Server 的开发计划，仅专注交付高强健度的 CLI 以及配套的 Agent Skill。
CLI 已完美支持 `--json` 输出与统一错误码，满足 Agent 直接消费调用的要求。

## 17. 交付物

开发助手最终应交付：

- 可运行的源代码。
- 锁定版本的依赖文件。
- Windows 安装或本地运行脚本。
- README。
- 架构决策记录 ADR。
- 自动化测试。
- 公版测试 EPUB 或生成测试书的脚本。
- 脱敏的真实链路验证报告。
- 已知限制和下一步清单（含 Agent Skill 定义）。

## 18. 给开发助手的执行指令

请按以下方式执行本项目：

1. 先检查开发环境和现有文件，不要只输出新的架构建议。
2. 如 Amazon 页面、邮件服务或依赖的当前行为不确定，先查官方资料或进行最小实验。
3. 先实现 Phase 0 和 Phase 1，再进入真实账号操作。
4. 涉及登录、二次验证、验证码、添加可信邮箱或发送真实邮件时，明确暂停并请用户确认。
5. 不保存 Amazon 密码，不输出 Cookie、邮箱令牌或完整个人邮箱。
6. 保持每个阶段都可独立运行和验证。
7. 遇到外部阻塞时，保留已完成代码，给出具体阻塞证据和最短恢复步骤。
8. 不在真实 Kindle 到达前宣称项目端到端完成。
9. CLI 验证成功以前，不开始 Agent Skill 封装。
10. 最终报告只陈述已经验证的结果，并列出仍未知的部分。

## 19. 项目的一句话判断

Kindle Bridge 不是“让 AI 每次操控 Send to Kindle 网页”，而是：

> 通过一次性连接向导建立稳定投递通道，让人和 AI 以后都能用同一个 CLI 将内容可靠地发送到 Kindle。
