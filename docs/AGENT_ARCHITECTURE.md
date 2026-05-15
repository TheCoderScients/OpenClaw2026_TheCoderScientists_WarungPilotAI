# Agent Architecture

WarungPilot AI is an agent-first project. The UI is only a cockpit for demo and
owner control.

## Autonomous Task

Given unstructured customer chats, the agent autonomously completes this task:

```txt
Create structured order drafts, invoice totals, payment requests, and approval
tasks without manual intervention.
```

The owner is only required after the autonomous task is complete, because
customer-facing messages and payment instructions are intentionally
approval-gated.

## Autonomous Loop (ReAct Pattern)

WarungPilot AI uses a **ReAct-style autonomous agent loop**:

```
Think → Act → Observe → repeat until done
```

1. The LLM receives customer messages and a list of available tools.
2. It **reasons** about what to do next (Think).
3. It **selects and calls** a tool with arguments (Act).
4. It **observes** the tool result and decides the next step (Observe).
5. The loop continues until all customers are processed.
6. If AI is unavailable, the system falls back to a deterministic pipeline.

This is a true autonomous loop — the LLM decides the execution order, handles
edge cases dynamically, and processes each customer differently based on their
intent.

## Agent Roles

- Planner Agent: decomposes customer chat into workflow steps.
- Customer Intent Agent: detects business intent.
- Order Agent: extracts products and quantities.
- Inventory Agent: checks stock and low-stock risk.
- Finance Agent: creates invoice-ready totals.
- Payment Agent: creates payment references and reconciliation notes.
- Approval Agent: creates owner approval tasks.
- Reflection Agent: scores risk and missing information.
- Model Reviewer: asks Kiro through 9Router to review the agent output. Ollama
  or OpenAI-compatible providers can be used as backup.
- Memory Agent: persists run trace for auditability.

## Tools (Available to LLM)

- `parse_messages` — Parse raw chat into structured messages
- `get_inventory` — List products, prices, and stock levels
- `classify_intent` — Classify a customer's business intent
- `extract_order` — Extract order lines and check stock
- `generate_invoice` — Create invoice for valid orders
- `create_payment_task` — Create traceable payment reference
- `create_doku_checkout` — Create real DOKU payment link (QRIS/VA)
- `create_approval_task` — Create owner approval gate
- `send_telegram_approval` — Send approval to owner via Telegram
- `reflect_on_run` — Score risk and missing information
- `save_to_memory` — Persist run trace

## Fallback

If the AI model is unavailable, the system automatically falls back to a
deterministic sequential pipeline that produces the same structured output.
This ensures the agent always completes its task.

## Success Criteria

- At least one valid customer order is transformed into invoice-ready output.
- Payment task has amount, invoice number, reference, and approval state.
- Customer-facing response is blocked until owner approval.
- Run trace is stored in `.data/agent-memory.json`.
- Reflection includes a real Kiro model assessment from `kr/claude-sonnet-4.5`
  when 9Router is running.
- Loop trace shows Think → Act → Observe pattern when AI is active.
