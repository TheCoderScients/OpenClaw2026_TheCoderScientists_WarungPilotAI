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

## Agent Roles

- Planner Agent: decomposes customer chat into workflow steps.
- Customer Intent Agent: detects business intent.
- Order Agent: extracts products and quantities.
- Inventory Agent: checks stock and low-stock risk.
- Finance Agent: creates invoice-ready totals.
- Payment Agent: creates payment references and reconciliation notes.
- Approval Agent: creates owner approval tasks.
- Reflection Agent: scores risk and missing information.
- Optional Model Reviewer: asks Ollama/OpenAI-compatible models to review the
  agent output when configured.
- Memory Agent: persists run trace for auditability.

## Tools

- `intent_classifier`
- `order_extractor`
- `inventory_lookup`
- `invoice_generator`
- `payment_task_generator`
- `approval_gate`
- `risk_reflection`
- `ops_memory`

## Success Criteria

- At least one valid customer order is transformed into invoice-ready output.
- Payment task has amount, invoice number, reference, and approval state.
- Customer-facing response is blocked until owner approval.
- Run trace is stored in `.data/agent-memory.json`.
