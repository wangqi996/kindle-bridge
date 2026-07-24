# ADR-001: Kindle Bridge 架构决策与选型规范

## 状态
已通过 (Approved)

## 日期
2026-07-22

## 背景与目标
Kindle Bridge 是一个本地优先的 Kindle 内容投递 CLI 工具。为保证核心逻辑高可靠、安全脱敏且可在未来扩展至 MCP/Skill 架构，需在此对基础设施、凭据存储、EPUB 转换选型及传输层抽象进行标准化决策。

---

## 决策条款

### 1. 核心解耦架构
- **规范**: 核心模块（转换、EPUB 生成、凭据管理、传输层接口、任务追踪）不得直接依赖 CLI 命令行解析库（如 Commander），所有输入通过 Plain TypeScript Objects / Interfaces 传递。
- **目的**: 保证未来开发 MCP Server 或 UI 时可无缝导入 `src/core` 及 `src/converter`，复用底层所有逻辑。

### 2. EPUB 生成与标准合规
- **规范**:
  - 选用符合 IDPF EPUB 3/2 规范的生成架构，使用 `jszip` 结合标准 `mimetype`、`META-INF/container.xml`、`content.opf`、`toc.ncx` / `nav.xhtml` 模板构建。
  - 默认标记 `<dc:language>zh-CN</dc:language>`。
  - HTML 内容必须经过 `cheerio` + `sanitize-html` 处理，清除 script、iframe、外链跟踪脚本等危险标签。
- **目的**: 避免外部不维护第三方库引入的漏洞与不兼容问题，确保生成的 EPUB 能被 Amazon Send-to-Kindle 顺利解析重排。

### 3. 本地存储与凭据安全 (Security & Sensitive Data Masking)
- **规范**:
  - **配置文件**: 放置于用户目录 `%APPDATA%\kindle-bridge\config.json`（不含任何明文凭据/密码/全量邮箱）。
  - **任务历史**: 持久化于 `%LOCALAPPDATA%\kindle-bridge\jobs\job_<id>.json`。
  - **系统凭据库**: 邮箱 OAuth/SMTP 凭据使用 Windows Credential Manager / 加密机密库存储，绝不出明文 JSON 文件。
  - **日志脱敏**: Logger 统一实现敏感数据脱敏过滤器，将邮箱地址格式化为 `w***@kindle.com`，且在调试日志中同样禁止输出 Cookie、密码或全文正文。

### 4. 任务状态与错误模型
- **规范**:
  - 状态分为 `created` -> `converted` -> `validated` -> `submitted` -> `provider_accepted` -> `amazon_accepted` -> `amazon_rejected` -> `device_confirmed` -> `failed`。
  - 未经确凿亚马逊回执或用户设备端确认，状态严格维持为 `provider_accepted`，不夸大宣称“Kindle 已收到”。
  - 统一错误代码系统 (如 `KINDLE_CONFIG_MISSING`, `KINDLE_EPUB_INVALID` 等)，所有错误包含人类可读提示与引导命令。
