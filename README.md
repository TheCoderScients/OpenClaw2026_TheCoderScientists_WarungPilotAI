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
```

## Judging Focus

WarungPilot AI is intentionally agent-first. The UI is only an operator cockpit
to demonstrate the agent workflow and approval gate.

