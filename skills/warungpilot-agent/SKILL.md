---
name: warungpilot-agent
description: Run WarungPilot AI, an autonomous commerce operations agent for Indonesian SME customer chats, orders, invoices, payment requests, and owner approval tasks.
user-invocable: true
---

# WarungPilot AI Agent

Use this skill when customer chat needs to become structured commerce work:
order extraction, stock check, invoice draft, payment task, owner approval, and
Telegram-ready reply.

## Local Endpoint

```txt
POST http://localhost:3000/api/openclaw/analyze
```

## Run

```powershell
node skills/warungpilot-agent/scripts/analyze.mjs --message "[Ayu] Aku mau 2 risol mayo dan 1 es kopi"
```

## Agent Workflow

1. Planner Agent breaks chat into work items.
2. Customer Intent Agent classifies intent.
3. Order Agent extracts product and quantity.
4. Inventory Agent checks stock risk.
5. Finance Agent creates invoice-ready totals.
6. Payment Agent creates payment task and reference.
7. Approval Agent blocks outgoing customer action until owner approves.
8. Reflection Agent scores risk and missing information.
9. Memory Agent stores run trace.

## Safety

- Never bypass owner approval.
- Never invent prices outside inventory.
- Never expose environment variables or bot tokens.
- Payment instructions remain approval-gated.

