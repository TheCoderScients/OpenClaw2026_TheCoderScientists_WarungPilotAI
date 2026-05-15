import { randomUUID } from "node:crypto";
import { defaultMessages, defaultStoreName } from "@/agent/data";
import { rememberAgentRun } from "@/agent/memory";
import {
  createApprovalTask,
  createInvoice,
  createPaymentTask,
  detectIntent,
  draftOrder,
  normalizeInventory,
  parseCustomerMessages,
} from "@/agent/tools";
import type {
  AgentPlanStep,
  AgentReflection,
  AgentRunInput,
  AgentRunResult,
  InvoiceDraft,
  PaymentTask,
} from "@/agent/types";

export async function runWarungPilotAgent(
  input: Partial<AgentRunInput> = {},
): Promise<AgentRunResult> {
  const createdAt = new Date().toISOString();
  const runId = randomUUID();
  const storeName = input.storeName?.trim() || defaultStoreName;
  const messages = parseCustomerMessages(input.messages || defaultMessages);
  const inventory = normalizeInventory(input.inventory);
  const plan: AgentPlanStep[] = [];

  plan.push(
    completeStep(
      "plan",
      "Planner Agent",
      "Break incoming customer messages into commerce operations.",
      "workflow_planner",
      `Prepared ${messages.length} message-level work items.`,
    ),
  );

  const intents = messages.map((message) => detectIntent(message));
  plan.push(
    completeStep(
      "intent",
      "Customer Intent Agent",
      "Classify each message into deterministic business intent.",
      "intent_classifier",
      `Classified ${intents.length} customer intents.`,
    ),
  );

  const orders = messages.map((message) => draftOrder(message, inventory));
  plan.push(
    completeStep(
      "order",
      "Order Agent",
      "Extract product, quantity, stock, and customer order status.",
      "order_extractor",
      `${orders.filter((order) => order.status === "valid").length} valid orders prepared.`,
    ),
  );

  plan.push(
    completeStep(
      "inventory",
      "Inventory Agent",
      "Check stock availability and low-stock risk.",
      "inventory_lookup",
      `${orders.flatMap((order) => order.lines).filter((line) => line.stockStatus !== "available").length} stock risks detected.`,
    ),
  );

  const validOrders = orders.filter((order) => order.status === "valid");
  const invoices: InvoiceDraft[] = validOrders.map((order, index) =>
    createInvoice(order, index + 1),
  );
  plan.push(
    completeStep(
      "invoice",
      "Finance Agent",
      "Generate invoice-ready totals for valid orders.",
      "invoice_generator",
      `${invoices.length} invoices generated.`,
    ),
  );

  const paymentTasks: PaymentTask[] = invoices.map((invoice) =>
    createPaymentTask(invoice),
  );
  plan.push(
    completeStep(
      "payment",
      "Payment Agent",
      "Prepare traceable payment requests with reconciliation references.",
      "payment_task_generator",
      `${paymentTasks.length} payment tasks prepared behind owner approval.`,
    ),
  );

  const approvals = orders.map((order) => {
    const intent = intents.find((item) => item.customer === order.customer) ?? intents[0];
    const invoice = invoices.find((item) => item.customer === order.customer);
    const payment = paymentTasks.find((item) => item.customer === order.customer);

    return createApprovalTask({ intent, invoice, order, payment });
  });
  plan.push({
    ...completeStep(
      "approval",
      "Approval Agent",
      "Create owner approval tasks before customer-facing actions.",
      "approval_gate",
      `${approvals.length} approval tasks are waiting for owner decision.`,
    ),
    status: "needs_owner",
  });

  const reflection = reflectOnRun({
    invoices,
    paymentTasks,
    plan,
    validOrderCount: validOrders.length,
  });
  plan.push(
    completeStep(
      "reflect",
      "Reflection Agent",
      "Score operational risk and decide whether the result is ready.",
      "risk_reflection",
      reflection.rationale,
    ),
  );

  const result: AgentRunResult = {
    runId,
    createdAt,
    storeName,
    messages,
    plan,
    intents,
    orders,
    invoices,
    paymentTasks,
    approvals,
    reflection,
    memory: {
      persisted: false,
      recordPath: ".data/agent-memory.json",
    },
    metrics: {
      totalMessages: messages.length,
      validOrders: validOrders.length,
      revenue: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
      paymentTasks: paymentTasks.length,
      approvalsWaiting: approvals.length,
    },
  };

  result.memory = await rememberAgentRun(result);
  plan.push(
    completeStep(
      "memory",
      "Memory Agent",
      "Persist run trace for auditability and future context.",
      "ops_memory",
      result.memory.persisted
        ? "Run stored in local ops memory."
        : "Run completed but memory persistence failed.",
    ),
  );

  return result;
}

function completeStep(
  id: string,
  agent: AgentPlanStep["agent"],
  goal: string,
  tool: string,
  observation: string,
): AgentPlanStep {
  return {
    id,
    agent,
    goal,
    observation,
    status: "completed",
    tool,
  };
}

function reflectOnRun({
  invoices,
  paymentTasks,
  validOrderCount,
}: {
  invoices: InvoiceDraft[];
  paymentTasks: PaymentTask[];
  plan: AgentPlanStep[];
  validOrderCount: number;
}): AgentReflection {
  const missingInformation: string[] = [];

  if (validOrderCount === 0) {
    missingInformation.push("No valid customer order was detected.");
  }

  if (paymentTasks.length !== invoices.length) {
    missingInformation.push("Some valid invoices do not have payment tasks.");
  }

  const riskScore = Math.min(
    100,
    missingInformation.length * 35 + Math.max(0, invoices.length - paymentTasks.length) * 20,
  );
  const decision =
    validOrderCount === 0
      ? "needs_clarification"
      : riskScore >= 70
        ? "blocked"
        : "ready_for_owner_approval";

  return {
    autonomousTaskCompleted:
      "Prepared structured orders, invoice totals, payment requests, and approval-gated replies without manual intervention.",
    decision,
    missingInformation,
    rationale:
      decision === "ready_for_owner_approval"
        ? "Agent output is ready for owner approval; customer-facing actions remain gated."
        : "Agent requires clarification before a customer-facing action can be approved.",
    riskScore,
  };
}

