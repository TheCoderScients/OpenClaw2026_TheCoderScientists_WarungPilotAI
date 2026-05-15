# Devpost Copy

## Project Name

WarungPilot AI

## Elevator Pitch

An autonomous commerce operations agent for Indonesian SMEs that uses a
ReAct-style agent loop to turn customer chats into orders, invoices, payment
requests, and owner-approved replies — without manual intervention.

## Built With

Next.js, React, TypeScript, Tailwind CSS, OpenClaw-compatible skill, Telegram
Bot API approval workflow, DOKU Checkout payment integration (QRIS + Virtual
Account), ReAct autonomous agent loop with 11 dynamically-selected tools,
local file memory, and AI routing through Kiro/9Router (Claude Sonnet 4.5).

## Short Description

WarungPilot AI is not a chatbot wrapper and not a UI-only dashboard. It is a
commerce operations agent with a ReAct-style autonomous loop: the LLM reasons
about what to do, selects from 11 available tools, executes them, observes the
results, and loops until all tasks are complete. It processes customer chats
into structured orders, invoices, payment tasks, and owner-approved replies
entirely autonomously.

When AI is unavailable, the system falls back to a deterministic pipeline —
ensuring the agent always completes its task.

## Payment Use Case

The Payment Agent creates payment tasks with invoice number, amount, reference
code, channel, approval state, and reconciliation note. It also has a DOKU
Checkout adapter for QRIS and Virtual Account payment links, HMAC-SHA256
signed requests, webhook signature verification, local payment ledger
persistence, and a backup DOKU status check endpoint. This makes the payment
instruction traceable and prevents the agent from sending payment details
before owner approval.
