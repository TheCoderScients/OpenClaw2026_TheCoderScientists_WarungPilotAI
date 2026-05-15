# WarungPilot AI

Autonomous commerce operations agent for Indonesian SMEs.

This project is built for OpenClaw Agenthon 2026. The main product is the agent:
it reads customer chat, plans business operations, uses tools, reflects on risk,
stores memory, and prepares owner-approved actions.

## Core Goal

Turn messy customer chats into:

- structured orders
- stock decisions
- invoice-ready totals
- payment requests
- owner approval tasks
- Telegram-ready replies
- operational memory

## Run

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Agent API

```txt
POST /api/agent/run
POST /api/openclaw/analyze
POST /api/telegram/approval
```

## OpenClaw Skill

```txt
skills/warungpilot-agent/SKILL.md
```

Run after the dev server is active:

```powershell
node skills/warungpilot-agent/scripts/analyze.mjs --message "[Ayu] Aku mau 2 risol mayo dan 1 es kopi"
```

## Judging Focus

WarungPilot AI is intentionally agent-first. The UI is only an operator cockpit
to demonstrate the agent workflow and approval gate.

See `docs/AGENT_ARCHITECTURE.md` for the agent system and `docs/DEVPOST.md` for
submission copy.
