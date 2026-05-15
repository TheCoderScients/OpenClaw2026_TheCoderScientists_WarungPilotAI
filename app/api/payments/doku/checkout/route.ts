import { NextResponse } from "next/server";
import { createDokuCheckout } from "@/integrations/doku";
import { recordDokuCheckout } from "@/integrations/doku-store";
import type { PaymentTask } from "@/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (!isRecord(body) || !isPaymentTask(body.payment)) {
    return NextResponse.json(
      {
        ok: false,
        error: "payment task payload is required",
      },
      {
        status: 400,
      },
    );
  }

  const result = await createDokuCheckout(body.payment);

  await recordDokuCheckout(body.payment, result);

  return NextResponse.json(result, {
    status: result.ok || result.mode === "not_configured" ? 200 : 502,
  });
}

function isPaymentTask(value: unknown): value is PaymentTask {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.customer === "string" &&
    typeof value.invoiceNumber === "string" &&
    typeof value.amount === "number" &&
    typeof value.reference === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
