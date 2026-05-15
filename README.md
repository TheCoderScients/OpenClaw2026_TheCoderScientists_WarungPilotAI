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

## Real AI Model

Default judging config uses Kiro through 9Router:

```env
AI_PROVIDER=kiro
KIRO_BASE_URL=http://127.0.0.1:20128/v1
KIRO_MODEL=kr/claude-sonnet-4.5
```

Start 9Router before running the demo:

```powershell
.\run-kiro-router.cmd
```

Mock/disabled AI is only a last-resort fallback. The deterministic commerce
workflow still runs, but the Reflection Agent displays the real model assessment
when Kiro is available.

## Agent API

```txt
POST /api/agent/run
POST /api/openclaw/analyze
POST /api/telegram/approval
POST /api/payments/doku/checkout
POST /api/payments/doku/notification
GET  /api/payments/doku/status/[invoice]
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

## DOKU Checkout

WarungPilot AI includes a DOKU Checkout adapter for the payment use case. The
flow is server-side: checkout URL creation, signed notification verification,
payment ledger persistence, and backup status checks.

Keep `DOKU_ENV=sandbox` until the sandbox simulator succeeds. Switch to
`DOKU_ENV=production` only with real merchant credentials and a reachable public
webhook URL.

```env
DOKU_ENV=sandbox
DOKU_CLIENT_ID=
DOKU_SECRET_KEY=
DOKU_PAYMENT_METHOD_TYPES=VIRTUAL_ACCOUNT_DOKU
DOKU_CALLBACK_URL=https://your-domain.com/api/payments/doku/return
DOKU_NOTIFICATION_URL=https://your-domain.com/api/payments/doku/notification
DOKU_WEBHOOK_VERIFY=true
```

The Payment Agent still requires owner approval before any DOKU checkout link is
sent to a customer.

See `docs/DOKU_REAL_PAYMENT.md` for the exact DOKU setup checklist.
