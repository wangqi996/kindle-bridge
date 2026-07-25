---
name: kindle-for-agents
description: Primary router for Kindle for Agents. Use when an Agent needs to configure, repair, check, or use the local Kindle delivery capability; route setup work to kindle-setup and ready-state document delivery to send-to-kindle without loading both workflows.
---

# Kindle for Agents Router

Run `kindle --json capability`.

- If `data.ready` is `true`, read and follow `../send-to-kindle/SKILL.md`.
- Otherwise, read and follow `../kindle-setup/SKILL.md`.

Do not duplicate configuration instructions or ask for credentials here.
