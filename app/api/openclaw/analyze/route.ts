import { NextResponse } from "next/server";
import { defaultMessages } from "@/agent/data";
import { runWarungPilotAgent } from "@/agent/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const messages = readMessages(body);
  const result = await runWarungPilotAgent({ messages });

  return NextResponse.json(
    {
      ok: true,
      source: "openclaw",
      agent: "warungpilot-agent",
      summaryText: createSummary(result),
      autonomousTaskCompleted: result.reflection.autonomousTaskCompleted,
      plan: result.plan,
      paymentActions: result.paymentTasks.map((task) => ({
        customer: task.customer,
        invoiceNumber: task.invoiceNumber,
        amount: task.amount,
        reference: task.reference,
        channel: task.channel,
        requiresOwnerApproval: true,
      })),
      approvalActions: result.approvals.map((approval) => ({
        customer: approval.customer,
        intent: approval.intent,
        suggestedReply: approval.suggestedReply,
        requiresOwnerApproval: true,
      })),
      result,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function readMessages(body: unknown): string {
  if (!isRecord(body)) {
    return defaultMessages;
  }

  const messages = body.messages || body.message;
  return typeof messages === "string" && messages.trim()
    ? messages
    : defaultMessages;
}

function createSummary(result: Awaited<ReturnType<typeof runWarungPilotAgent>>) {
  return [
    `WarungPilot AI processed ${result.metrics.totalMessages} customer messages.`,
    `${result.metrics.validOrders} valid orders became invoice-ready tasks.`,
    `${result.metrics.paymentTasks} payment requests were prepared behind owner approval.`,
    `Autonomy proof: ${result.reflection.autonomousTaskCompleted}`,
  ].join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

