import { NextResponse } from "next/server";
import { sendOwnerApproval } from "@/integrations/telegram";
import type { ApprovalTask, PaymentTask } from "@/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!isRecord(body) || !isApprovalTask(body.approval)) {
    return NextResponse.json(
      {
        ok: false,
        error: "approval payload is required",
      },
      {
        status: 400,
      },
    );
  }

  const result = await sendOwnerApproval({
    approval: body.approval,
    ownerChatId:
      typeof body.ownerChatId === "string" ? body.ownerChatId : undefined,
    payment: isPaymentTask(body.payment) ? body.payment : undefined,
  });

  return NextResponse.json({
    ok: result.ok,
    skipped: result.skipped,
    detail: result.detail,
  });
}

function isApprovalTask(value: unknown): value is ApprovalTask {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.customer === "string" &&
    typeof value.suggestedReply === "string" &&
    value.status === "waiting_owner_approval"
  );
}

function isPaymentTask(value: unknown): value is PaymentTask {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.customer === "string" &&
    typeof value.reference === "string" &&
    typeof value.amount === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

