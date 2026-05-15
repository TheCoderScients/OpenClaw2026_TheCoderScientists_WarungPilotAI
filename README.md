# WarungPilot AI

Autonomous commerce operations agent for Indonesian SMEs.

Built for **OpenClaw Agenthon 2026**. The main product is the **autonomous
agent**: it reads customer chat, reasons about what to do, selects tools
dynamically, processes orders and payments, and loops until all tasks are
complete — without manual intervention.

## Quick Start

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Click **▶ Run Agent** to execute the autonomous
workflow.

## Autonomous Agent Loop

WarungPilot AI uses a **ReAct-style autonomous loop**:

```
Think → Act → Observe → repeat until done
```

The LLM receives a list of 11 available tools and customer messages. It
**reasons** about what to do, **selects** a tool, **executes** it, **observes**
the result, and decides the next step. The loop continues until all customers
are processed.

If AI is unavailable, the system falls back to a deterministic sequential
pipeline — the agent always completes its task.

### Available Tools

| Tool | Description |
|------|-------------|
| `parse_messages` | Parse raw chat into structured messages |
| `get_inventory` | List products, prices, and stock levels |
| `classify_intent` | Classify customer intent (buy, ask_price, complaint, etc.) |
| `extract_order` | Extract order lines and check stock availability |
| `generate_invoice` | Create invoice for valid orders |
| `create_payment_task` | Create traceable payment reference |
| `create_doku_checkout` | Create real DOKU payment link (QRIS / Virtual Account) |
| `create_approval_task` | Create owner approval gate |
| `send_telegram_approval` | Send approval to owner via Telegram |
| `reflect_on_run` | Score operational risk and missing information |
| `save_to_memory` | Persist run trace for auditability |

## AI Model

Default config uses Kiro through 9Router:

```env
AI_PROVIDER=kiro
KIRO_BASE_URL=http://127.0.0.1:20128/v1
KIRO_MODEL=kr/claude-sonnet-4.5
```

Start 9Router before running the demo:

```powershell
.\run-kiro-router.cmd
```

Ollama (`qwen3:1.7b`) and any OpenAI-compatible provider are also supported.

## Agent API

```txt
POST /api/agent/run          — Run the full autonomous agent
POST /api/openclaw/analyze   — OpenClaw skill endpoint
POST /api/telegram/approval  — Send approval to Telegram
POST /api/payments/doku/checkout      — Create DOKU payment link
POST /api/payments/doku/notification  — DOKU webhook receiver
GET  /api/payments/doku/status/[inv]  — Check DOKU payment status
```

## OpenClaw Skill

```txt
skills/warungpilot-agent/SKILL.md
```

Run after the dev server is active:

```powershell
node skills/warungpilot-agent/scripts/analyze.mjs --message "[Ayu] Aku mau 2 risol mayo dan 1 es kopi"
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in credentials:

```powershell
copy .env.example .env.local
```

Required for full functionality:
- **AI**: At least one AI provider (Kiro, Ollama, or OpenAI-compatible)
- **DOKU**: `DOKU_CLIENT_ID` and `DOKU_SECRET_KEY` for payment integration
- **Telegram**: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_CHAT_ID` for approval

The agent runs without any credentials (deterministic fallback), but AI and
integrations enhance the experience significantly.

## DOKU Payment

WarungPilot AI includes a real DOKU Checkout adapter for the payment use case:
checkout URL creation, signed webhook verification, payment ledger persistence,
and backup status checks. See `docs/DOKU_REAL_PAYMENT.md` for setup details.

## Architecture

See `docs/AGENT_ARCHITECTURE.md` for the full agent system documentation.

## Judging Focus

WarungPilot AI is intentionally **agent-first**. The UI is an operator cockpit
to demonstrate the autonomous workflow and approval gate. The core value is the
**ReAct agent loop** that processes commerce operations autonomously.
