# WarungPilot AI

Autonomous commerce operations agent for Indonesian SMEs.

Built for **OpenClaw Agenthon 2026**. The main product is the **autonomous
agent**: it reads customer chat, reasons about what to do, selects tools
dynamically, processes orders and payments, and loops until all tasks are
complete — without manual intervention.

---

## Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | v18+ (tested on v24) | `node -v` |
| npm | v9+ | `npm -v` |
| AI Provider | Kiro/9Router **or** Ollama **or** OpenAI-compatible | See [AI Setup](#ai-setup) |

> **Note:** The agent runs without any AI provider (deterministic fallback),
> but the autonomous ReAct loop requires at least one AI provider to be active.

---

## Installation

```powershell
# 1. Clone the repository
git clone https://github.com/TheCoderScients/OpenClaw2026_TheCoderScientists_WarungPilotAI.git
cd OpenClaw2026_TheCoderScientists_WarungPilotAI

# 2. Install dependencies
npm install

# 3. Copy environment config
copy .env.example .env.local

# 4. (Optional) Fill in credentials in .env.local — see sections below

# 5. Start the development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Usage

### Via Browser (Recommended for Demo)

1. Open `http://localhost:3000`
2. The default demo messages are pre-filled in the input area
3. Click **▶ Run Agent**
4. Wait ~30–90 seconds for the autonomous loop to complete
5. Observe the **Agent Trace** panel on the right — each step shows:
   - 💭 The LLM's reasoning (what it decided to do and why)
   - The tool it selected and executed
   - The observation/result
6. The **⚡ Autonomous Loop** badge confirms the ReAct loop is active
7. Metrics (messages, orders, revenue, approvals) appear on the left

### Via Terminal (API)

```powershell
# Run with default demo messages
curl -X GET http://localhost:3000/api/agent/run

# Run with custom messages
curl -X POST http://localhost:3000/api/agent/run ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\": \"[Ayu] Aku mau 2 risol mayo dan 1 es kopi\"}"
```

### Via OpenClaw Skill

```powershell
node skills/warungpilot-agent/scripts/analyze.mjs --message "[Ayu] Aku mau 2 risol mayo dan 1 es kopi"
```

---

## AI Setup

The autonomous loop needs an AI provider. Choose **one**:

### Option A: Kiro via 9Router (Default)

```env
AI_PROVIDER=kiro
KIRO_BASE_URL=http://127.0.0.1:20128/v1
KIRO_MODEL=kr/claude-sonnet-4.5
```

Start 9Router before running:

```powershell
.\run-kiro-router.cmd
```

### Option B: Ollama (Local)

```powershell
# Install and run Ollama, then pull a model
ollama pull qwen3:1.7b
```

```env
AI_PROVIDER=local
LOCAL_AI_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_AI_MODEL=qwen3:1.7b
```

### Option C: OpenAI-compatible

```env
AI_PROVIDER=openai
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

### No AI (Deterministic Fallback)

If no AI provider is available, the agent automatically falls back to a
deterministic sequential pipeline. It still produces the same structured
output (orders, invoices, payments, approvals) but without LLM-driven
reasoning.

---

## Autonomous Agent Loop

WarungPilot AI uses a **ReAct-style autonomous loop**:

```
Think → Act → Observe → repeat until done
```

1. The LLM receives customer messages and a list of 11 available tools
2. It **reasons** about what to do next (Think)
3. It **selects and calls** a tool with arguments (Act)
4. It **observes** the tool result (Observe)
5. It decides the next step and loops
6. When all customers are processed, it calls `FINISH`

### Example Loop Trace

```
Step 1: "I need to parse messages first" → parse_messages
Step 2: "Let me check the inventory" → get_inventory
Step 3: "Ayu wants to buy, classify her intent" → classify_intent
Step 4: "Extract Ayu's order from the message" → extract_order
Step 5: "Order is valid, generate invoice" → generate_invoice
Step 6: "Create payment task for Ayu" → create_payment_task
Step 7: "Create approval gate for Ayu" → create_approval_task
...
Step N: "All done, save to memory" → save_to_memory → FINISH
```

### Available Tools

| # | Tool | Agent | Description |
|---|------|-------|-------------|
| 1 | `parse_messages` | Planner | Parse raw chat into structured messages |
| 2 | `get_inventory` | Inventory | List products, prices, and stock levels |
| 3 | `classify_intent` | Intent | Classify intent (buy, ask_price, complaint, etc.) |
| 4 | `extract_order` | Order | Extract order lines and check stock |
| 5 | `generate_invoice` | Finance | Create invoice for valid orders |
| 6 | `create_payment_task` | Payment | Create traceable payment reference |
| 7 | `create_doku_checkout` | Payment | Create real DOKU payment link |
| 8 | `create_approval_task` | Approval | Create owner approval gate |
| 9 | `send_telegram_approval` | Approval | Send approval to owner via Telegram |
| 10 | `reflect_on_run` | Reflection | Score risk and missing information |
| 11 | `save_to_memory` | Memory | Persist run trace for auditability |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agent/run` | Run agent with default demo messages |
| `POST` | `/api/agent/run` | Run agent with custom messages |
| `POST` | `/api/openclaw/analyze` | OpenClaw skill endpoint |
| `POST` | `/api/telegram/approval` | Send approval to Telegram |
| `POST` | `/api/payments/doku/checkout` | Create DOKU payment link |
| `POST` | `/api/payments/doku/notification` | DOKU webhook receiver |
| `GET` | `/api/payments/doku/status/[inv]` | Check DOKU payment status |

---

## DOKU Payment Integration

WarungPilot AI includes a **real DOKU Checkout adapter**:

- HMAC-SHA256 signed requests and response verification
- Webhook notification with timing-safe signature verification
- Local payment ledger (`.data/doku-payments.json`)
- Sandbox ↔ Production mode switching
- QRIS auto-fallback to Virtual Account in sandbox

```env
DOKU_ENV=sandbox
DOKU_CLIENT_ID=MCH-...
DOKU_SECRET_KEY=SK-...
```

See `docs/DOKU_REAL_PAYMENT.md` for the full setup checklist.

---

## Telegram Approval

The agent can send approval tasks to the store owner via Telegram:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_OWNER_CHAT_ID=your-chat-id
```

The owner sees an inline keyboard with **Approve** / **Reject** buttons.

---

## Project Structure

```
agent/
├── loop.ts           ← Autonomous ReAct loop engine
├── tool-registry.ts  ← 11 tools with descriptions for LLM
├── runtime.ts        ← Entry point (loop first, deterministic fallback)
├── ai.ts             ← AI provider routing (Kiro, Ollama, OpenAI)
├── tools.ts          ← Tool implementations (intent, order, invoice, etc.)
├── types.ts          ← TypeScript types
├── data.ts           ← Default inventory and demo messages
└── memory.ts         ← Persistence to .data/agent-memory.json

app/
├── page.tsx              ← Dashboard page
├── AgentWorkspace.tsx    ← Interactive agent cockpit (client component)
└── api/                  ← 7 API routes

integrations/
├── doku.ts           ← Full DOKU Checkout SDK
├── doku-store.ts     ← Payment ledger persistence
└── telegram.ts       ← Telegram Bot API

skills/warungpilot-agent/
├── SKILL.md          ← OpenClaw skill manifest
└── scripts/analyze.mjs  ← CLI runner
```

---

## Architecture

See `docs/AGENT_ARCHITECTURE.md` for the full agent architecture documentation.
