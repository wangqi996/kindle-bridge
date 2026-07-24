---
name: kindle-bridge
description: Compatibility router for Kindle Bridge requests. Use when an existing prompt names kindle-bridge; route first-time configuration to kindle-setup and routine document delivery to send-to-kindle without loading both workflows.
---

# Kindle Bridge Router

Run `kindle --json capability`.

- If `data.ready` is `true`, read and follow `../send-to-kindle/SKILL.md`.
- Otherwise, read and follow `../kindle-setup/SKILL.md`.

Do not duplicate configuration instructions or ask for credentials here.
