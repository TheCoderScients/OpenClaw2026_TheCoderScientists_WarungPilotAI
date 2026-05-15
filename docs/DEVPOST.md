# Devpost Copy

## Project Name

WarungPilot AI

## Elevator Pitch

An autonomous commerce operations agent for Indonesian SMEs that turns customer
chats into orders, invoices, payment requests, and owner-approved replies.

## Built With

Next.js, React, TypeScript, Tailwind CSS, OpenClaw-compatible skill, Telegram Bot
API-ready approval workflow, local file memory, and OpenAI-compatible AI routing
planned for deployment.

## Short Description

WarungPilot AI is not a chatbot wrapper and not a UI-only dashboard. It is a
commerce operations agent that plans a workflow, uses tools, reflects on risk,
stores memory, and prepares owner-approved business actions from messy customer
chat.

## Payment Use Case

The Payment Agent creates payment tasks with invoice number, amount, reference
code, channel, approval state, and reconciliation note. It also has a DOKU
Checkout adapter for QRIS and Virtual Account payment links, signed webhook
verification, local payment ledger persistence, and a backup DOKU status check
endpoint. This makes the payment instruction traceable and prevents the agent
from sending payment details before owner approval.
