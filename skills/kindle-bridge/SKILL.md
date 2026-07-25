---
name: kindle-bridge
description: Legacy compatibility router for Kindle Bridge requests. Use only when an existing prompt names kindle-bridge; route first-time configuration to kindle-setup and routine document delivery to send-to-kindle without loading both workflows.
---

# Kindle Bridge Legacy Router

The current product name and primary entry point are Kindle for Agents and
`$kindle-for-agents`. Keep this router only for existing prompts.

Run `kindle --json capability`.

- If `data.ready` is `true`, read and follow `../send-to-kindle/SKILL.md`.
- Otherwise, read and follow `../kindle-setup/SKILL.md`.

Do not duplicate configuration instructions or ask for credentials here.
