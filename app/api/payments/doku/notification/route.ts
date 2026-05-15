import { NextResponse } from "next/server";
import {
  parseDokuNotification,
  verifyDokuNotification,
} from "@/integrations/doku";
import { recordDokuNotification } from "@/integrations/doku-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const requestTarget = new URL(request.url).pathname;
  const verification = verifyDokuNotification({
    headers: request.headers,
    rawBody,
    requestTarget,
  });

  if (!verification.ok || !verification.requestId) {
    return NextResponse.json(
      {
        detail: verification.detail,
        ok: false,
      },
      {
        status: 401,
      },
    );
  }

  const notification = parseDokuNotification(rawBody, verification.requestId);

  await recordDokuNotification(notification);

  return NextResponse.json({
    invoiceNumber: notification.invoiceNumber,
    ok: true,
    status: notification.status,
  });
}
