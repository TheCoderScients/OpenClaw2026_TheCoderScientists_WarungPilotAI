import { defaultInventory } from "@/agent/data";
import { rememberAgentRun } from "@/agent/memory";
import {
  createApprovalTask,
  createInvoice,
  createPaymentTask,
  detectIntent,
  draftOrder,
  formatRupiah,
  parseCustomerMessages,
} from "@/agent/tools";
import type {
  AgentRunResult,
  ApprovalTask,
  CustomerMessage,
  IntentDecision,
  InvoiceDraft,
  InventoryItem,
  OrderDraft,
  PaymentTask,
} from "@/agent/types";
import { sendOwnerApproval } from "@/integrations/telegram";
import { createDokuCheckout } from "@/integrations/doku";
import { recordDokuCheckout } from "@/integrations/doku-store";

/* ------------------------------------------------------------------ */
/*  Shared loop context — accumulated state across iterations         */
/* ------------------------------------------------------------------ */

export type LoopContext = {
  storeName: string;
  rawMessages: string;
  inventory: InventoryItem[];

  /* Accumulated by tools */
  messages: CustomerMessage[];
  intents: IntentDecision[];
  orders: OrderDraft[];
  invoices: InvoiceDraft[];
  paymentTasks: PaymentTask[];
  approvals: ApprovalTask[];
  telegramResults: Array<{ customer: string; ok: boolean; detail: string }>;
  dokuResults: Array<{
    customer: string;
    ok: boolean;
    detail: string;
    paymentUrl?: string;
  }>;

  /* Bookkeeping */
  invoiceSequence: number;
  reflection?: {
    riskScore: number;
    missingInformation: string[];
    decision: string;
    rationale: string;
  };
  memory?: { persisted: boolean; recordPath: string };
};

export function createLoopContext(
  rawMessages: string,
  storeName: string,
  inventory?: InventoryItem[],
): LoopContext {
  return {
    storeName,
    rawMessages,
    inventory: inventory?.length ? inventory : defaultInventory,
    messages: [],
    intents: [],
    orders: [],
    invoices: [],
    paymentTasks: [],
    approvals: [],
    telegramResults: [],
    dokuResults: [],
    invoiceSequence: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Tool result                                                       */
/* ------------------------------------------------------------------ */

export type ToolResult = {
  ok: boolean;
  data: unknown;
  summary: string;
};

/* ------------------------------------------------------------------ */
/*  Tool definition                                                   */
/* ------------------------------------------------------------------ */

export type ToolParameter = {
  type: string;
  description: string;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  agentLabel: string;
  execute: (
    args: Record<string, unknown>,
    ctx: LoopContext,
  ) => Promise<ToolResult>;
};

/* ------------------------------------------------------------------ */
/*  Helper                                                            */
/* ------------------------------------------------------------------ */

function findMessage(
  ctx: LoopContext,
  customer: string,
): CustomerMessage | undefined {
  return ctx.messages.find(
    (m) => m.customer.toLowerCase() === customer.toLowerCase(),
  );
}

/* ------------------------------------------------------------------ */
/*  Tools                                                             */
/* ------------------------------------------------------------------ */

const parseMessages: AgentTool = {
  name: "parse_messages",
  description:
    "Parse raw customer chat text into structured messages. Call this first. No arguments needed.",
  parameters: {},
  agentLabel: "Planner Agent",
  execute: async (_args, ctx) => {
    ctx.messages = parseCustomerMessages(ctx.rawMessages);
    const customers = ctx.messages.map((m) => m.customer);
    return {
      ok: true,
      data: { count: ctx.messages.length, customers },
      summary: `Parsed ${ctx.messages.length} messages from: ${customers.join(", ")}.`,
    };
  },
};

const getInventory: AgentTool = {
  name: "get_inventory",
  description:
    "List all products in the store inventory with name, price, stock, and low-stock threshold.",
  parameters: {},
  agentLabel: "Inventory Agent",
  execute: async (_args, ctx) => {
    const items = ctx.inventory.map((i) => ({
      name: i.name,
      price: formatRupiah(i.price),
      stock: i.stock,
      lowStockThreshold: i.lowStockThreshold,
    }));
    return {
      ok: true,
      data: items,
      summary: `Inventory has ${items.length} products: ${items.map((i) => `${i.name} (${i.price}, stock ${i.stock})`).join("; ")}.`,
    };
  },
};

const classifyIntent: AgentTool = {
  name: "classify_intent",
  description:
    "Classify a single customer's business intent (buy, ask_price, complaint, discount, follow_up).",
  parameters: {
    customer: {
      type: "string",
      description: "Customer name exactly as returned by parse_messages.",
    },
  },
  agentLabel: "Customer Intent Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    const msg = findMessage(ctx, customer);
    if (!msg)
      return {
        ok: false,
        data: null,
        summary: `Customer "${customer}" not found in parsed messages.`,
      };

    const intent = detectIntent(msg);
    if (!ctx.intents.find((i) => i.customer === msg.customer)) {
      ctx.intents.push(intent);
    }
    return {
      ok: true,
      data: intent,
      summary: `${msg.customer}: intent="${intent.intent}" (confidence ${intent.confidence}). ${intent.reason}`,
    };
  },
};

const extractOrder: AgentTool = {
  name: "extract_order",
  description:
    "Extract order lines from a customer's message, match against inventory, and check stock availability. Returns order with status (valid / needs_clarification / blocked).",
  parameters: {
    customer: {
      type: "string",
      description: "Customer name exactly as returned by parse_messages.",
    },
  },
  agentLabel: "Order Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    const msg = findMessage(ctx, customer);
    if (!msg)
      return {
        ok: false,
        data: null,
        summary: `Customer "${customer}" not found.`,
      };

    const order = draftOrder(msg, ctx.inventory);
    if (!ctx.orders.find((o) => o.customer === msg.customer)) {
      ctx.orders.push(order);
    }
    return {
      ok: true,
      data: {
        customer: order.customer,
        status: order.status,
        lines: order.lines.map((l) => ({
          product: l.productName,
          qty: l.quantity,
          subtotal: formatRupiah(l.subtotal),
          stockStatus: l.stockStatus,
        })),
        total: formatRupiah(order.total),
        notes: order.notes,
      },
      summary:
        order.status === "valid"
          ? `${order.customer}: valid order, ${order.lines.length} item(s), total ${formatRupiah(order.total)}.`
          : `${order.customer}: ${order.status}. ${order.notes.join(" ")}`,
    };
  },
};

const generateInvoice: AgentTool = {
  name: "generate_invoice",
  description:
    'Generate an invoice for a customer who has a valid order. Only call for orders with status "valid".',
  parameters: {
    customer: {
      type: "string",
      description: "Customer name with a valid order.",
    },
  },
  agentLabel: "Finance Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    const order = ctx.orders.find(
      (o) =>
        o.customer.toLowerCase() === customer.toLowerCase() &&
        o.status === "valid",
    );
    if (!order)
      return {
        ok: false,
        data: null,
        summary: `No valid order found for "${customer}".`,
      };
    if (ctx.invoices.find((i) => i.customer === order.customer))
      return {
        ok: true,
        data: ctx.invoices.find((i) => i.customer === order.customer),
        summary: `Invoice already exists for ${order.customer}.`,
      };

    ctx.invoiceSequence += 1;
    const invoice = createInvoice(order, ctx.invoiceSequence);
    ctx.invoices.push(invoice);
    return {
      ok: true,
      data: {
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer,
        total: formatRupiah(invoice.total),
      },
      summary: `Invoice ${invoice.invoiceNumber} created for ${invoice.customer}, total ${formatRupiah(invoice.total)}.`,
    };
  },
};

const createPayment: AgentTool = {
  name: "create_payment_task",
  description:
    "Create a payment task with reconciliation reference for a customer who has an invoice. Payment is gated behind owner approval.",
  parameters: {
    customer: {
      type: "string",
      description: "Customer name with an existing invoice.",
    },
  },
  agentLabel: "Payment Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    const invoice = ctx.invoices.find(
      (i) => i.customer.toLowerCase() === customer.toLowerCase(),
    );
    if (!invoice)
      return {
        ok: false,
        data: null,
        summary: `No invoice found for "${customer}". Generate invoice first.`,
      };
    if (ctx.paymentTasks.find((p) => p.customer === invoice.customer))
      return {
        ok: true,
        data: ctx.paymentTasks.find((p) => p.customer === invoice.customer),
        summary: `Payment task already exists for ${invoice.customer}.`,
      };

    const task = createPaymentTask(invoice);
    ctx.paymentTasks.push(task);
    return {
      ok: true,
      data: {
        id: task.id,
        invoiceNumber: task.invoiceNumber,
        amount: formatRupiah(task.amount),
        reference: task.reference,
        channel: task.channel,
        status: task.status,
      },
      summary: `Payment task ${task.reference} created for ${task.customer}: ${formatRupiah(task.amount)} via ${task.channel}. Status: ${task.status}.`,
    };
  },
};

const createApproval: AgentTool = {
  name: "create_approval_task",
  description:
    "Create an owner-approval task for a customer. This gates all customer-facing actions. Call this for every customer, even those without orders.",
  parameters: {
    customer: {
      type: "string",
      description: "Customer name.",
    },
  },
  agentLabel: "Approval Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    if (
      ctx.approvals.find(
        (a) => a.customer.toLowerCase() === customer.toLowerCase(),
      )
    )
      return {
        ok: true,
        data: ctx.approvals.find(
          (a) => a.customer.toLowerCase() === customer.toLowerCase(),
        ),
        summary: `Approval already exists for ${customer}.`,
      };

    const order = ctx.orders.find(
      (o) => o.customer.toLowerCase() === customer.toLowerCase(),
    );
    const intent = ctx.intents.find(
      (i) => i.customer.toLowerCase() === customer.toLowerCase(),
    );
    const invoice = ctx.invoices.find(
      (i) => i.customer.toLowerCase() === customer.toLowerCase(),
    );
    const payment = ctx.paymentTasks.find(
      (p) => p.customer.toLowerCase() === customer.toLowerCase(),
    );

    if (!order || !intent) {
      return {
        ok: false,
        data: null,
        summary: `Need order and intent for "${customer}" before creating approval. Extract order and classify intent first.`,
      };
    }

    const approval = createApprovalTask({ intent, invoice, order, payment });
    ctx.approvals.push(approval);
    return {
      ok: true,
      data: {
        id: approval.id,
        customer: approval.customer,
        intent: approval.intent,
        status: approval.status,
        suggestedReply: approval.suggestedReply,
      },
      summary: `Approval task created for ${approval.customer} (${approval.intent}). Suggested reply ready, awaiting owner.`,
    };
  },
};

const sendTelegram: AgentTool = {
  name: "send_telegram_approval",
  description:
    "Send an approval task to the store owner's Telegram for review. Only call after creating an approval task. Requires Telegram credentials to be configured.",
  parameters: {
    customer: {
      type: "string",
      description: "Customer name with an existing approval task.",
    },
  },
  agentLabel: "Approval Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    const approval = ctx.approvals.find(
      (a) => a.customer.toLowerCase() === customer.toLowerCase(),
    );
    if (!approval)
      return {
        ok: false,
        data: null,
        summary: `No approval task for "${customer}".`,
      };
    const payment = ctx.paymentTasks.find(
      (p) => p.customer.toLowerCase() === customer.toLowerCase(),
    );

    const result = await sendOwnerApproval({ approval, payment });
    ctx.telegramResults.push({
      customer: approval.customer,
      ok: result.ok,
      detail: result.detail,
    });
    return {
      ok: result.ok,
      data: { ok: result.ok, skipped: result.skipped, detail: result.detail },
      summary: result.skipped
        ? `Telegram not configured: ${result.detail}`
        : result.ok
          ? `Approval sent to owner Telegram for ${approval.customer}.`
          : `Telegram send failed: ${result.detail}`,
    };
  },
};

const createDoku: AgentTool = {
  name: "create_doku_checkout",
  description:
    "Create a DOKU Checkout payment link (QRIS / Virtual Account) for a customer with a payment task. This is a real payment integration. Only call after owner would approve.",
  parameters: {
    customer: {
      type: "string",
      description: "Customer name with an existing payment task.",
    },
  },
  agentLabel: "Payment Agent",
  execute: async (args, ctx) => {
    const customer = String(args.customer ?? "");
    const payment = ctx.paymentTasks.find(
      (p) => p.customer.toLowerCase() === customer.toLowerCase(),
    );
    if (!payment)
      return {
        ok: false,
        data: null,
        summary: `No payment task for "${customer}".`,
      };

    const result = await createDokuCheckout(payment);
    await recordDokuCheckout(payment, result).catch(() => {});
    ctx.dokuResults.push({
      customer: payment.customer,
      ok: result.ok,
      detail: result.detail,
      paymentUrl: result.paymentUrl,
    });
    return {
      ok: result.ok,
      data: {
        ok: result.ok,
        mode: result.mode,
        detail: result.detail,
        paymentUrl: result.paymentUrl,
      },
      summary: result.ok
        ? `DOKU checkout created for ${payment.customer}: ${result.paymentUrl}`
        : `DOKU: ${result.detail}`,
    };
  },
};

const reflectOnRun: AgentTool = {
  name: "reflect_on_run",
  description:
    "Assess the overall run: score operational risk, identify missing information, and decide readiness. Call after processing all customers.",
  parameters: {},
  agentLabel: "Reflection Agent",
  execute: async (_args, ctx) => {
    const validOrders = ctx.orders.filter((o) => o.status === "valid").length;
    const missingInformation: string[] = [];

    if (validOrders === 0) {
      missingInformation.push("No valid customer order was detected.");
    }
    if (ctx.paymentTasks.length !== ctx.invoices.length) {
      missingInformation.push(
        "Some valid invoices do not have payment tasks.",
      );
    }
    const customersWithoutApproval = ctx.orders
      .map((o) => o.customer)
      .filter(
        (c) =>
          !ctx.approvals.find(
            (a) => a.customer.toLowerCase() === c.toLowerCase(),
          ),
      );
    if (customersWithoutApproval.length > 0) {
      missingInformation.push(
        `Customers without approval: ${customersWithoutApproval.join(", ")}.`,
      );
    }

    const riskScore = Math.min(
      100,
      missingInformation.length * 35 +
        Math.max(0, ctx.invoices.length - ctx.paymentTasks.length) * 20,
    );
    const decision =
      validOrders === 0
        ? "needs_clarification"
        : riskScore >= 70
          ? "blocked"
          : "ready_for_owner_approval";

    ctx.reflection = {
      riskScore,
      missingInformation,
      decision,
      rationale:
        decision === "ready_for_owner_approval"
          ? "Agent output is ready for owner approval; customer-facing actions remain gated."
          : "Agent requires clarification before a customer-facing action can be approved.",
    };

    return {
      ok: true,
      data: ctx.reflection,
      summary: `Risk score: ${riskScore}. Decision: ${decision}. ${missingInformation.length > 0 ? `Issues: ${missingInformation.join(" ")}` : "No issues found."}`,
    };
  },
};

const saveToMemory: AgentTool = {
  name: "save_to_memory",
  description:
    "Persist the full agent run trace to local memory for auditability. Call this as the final step.",
  parameters: {},
  agentLabel: "Memory Agent",
  execute: async (_args, ctx) => {
    const result = await buildPartialResult(ctx);
    const memResult = await rememberAgentRun(result);
    ctx.memory = memResult;
    return {
      ok: memResult.persisted,
      data: memResult,
      summary: memResult.persisted
        ? "Run trace saved to local ops memory."
        : "Memory persistence failed.",
    };
  },
};

/* ------------------------------------------------------------------ */
/*  Registry                                                          */
/* ------------------------------------------------------------------ */

export const allTools: AgentTool[] = [
  parseMessages,
  getInventory,
  classifyIntent,
  extractOrder,
  generateInvoice,
  createPayment,
  createApproval,
  sendTelegram,
  createDoku,
  reflectOnRun,
  saveToMemory,
];

export function findTool(name: string): AgentTool | undefined {
  return allTools.find((t) => t.name === name);
}

export function buildToolDescriptions(): string {
  return allTools
    .map((t) => {
      const params = Object.entries(t.parameters);
      const paramText =
        params.length === 0
          ? "No parameters."
          : params
              .map(([k, v]) => `  - ${k} (${v.type}): ${v.description}`)
              .join("\n");
      return `### ${t.name}\n${t.description}\nParameters:\n${paramText}`;
    })
    .join("\n\n");
}

/* ------------------------------------------------------------------ */
/*  Build partial AgentRunResult from context (for memory)            */
/* ------------------------------------------------------------------ */

async function buildPartialResult(ctx: LoopContext): Promise<AgentRunResult> {
  const validOrders = ctx.orders.filter((o) => o.status === "valid");
  return {
    runId: "loop-" + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    storeName: ctx.storeName,
    messages: ctx.messages,
    plan: [],
    intents: ctx.intents,
    orders: ctx.orders,
    invoices: ctx.invoices,
    paymentTasks: ctx.paymentTasks,
    approvals: ctx.approvals,
    reflection: {
      riskScore: ctx.reflection?.riskScore ?? 0,
      missingInformation: ctx.reflection?.missingInformation ?? [],
      autonomousTaskCompleted:
        "Autonomously processed customer chats through intent classification, order extraction, invoicing, payment task creation, and owner-approval gating without manual intervention.",
      decision:
        (ctx.reflection?.decision as
          | "ready_for_owner_approval"
          | "needs_clarification"
          | "blocked") ?? "ready_for_owner_approval",
      rationale: ctx.reflection?.rationale ?? "",
    },
    memory: ctx.memory ?? { persisted: false, recordPath: ".data/agent-memory.json" },
    metrics: {
      totalMessages: ctx.messages.length,
      validOrders: validOrders.length,
      revenue: ctx.invoices.reduce((s, i) => s + i.total, 0),
      paymentTasks: ctx.paymentTasks.length,
      approvalsWaiting: ctx.approvals.length,
    },
  };
}
