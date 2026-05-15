import { NextResponse } from "next/server";
import { checkDokuPaymentStatus } from "@/integrations/doku";
import { recordDokuStatus } from "@/integrations/doku-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await context.params;
  const result = await checkDokuPaymentStatus(decodeURIComponent(invoice));

  await recordDokuStatus(result);

  return NextResponse.json(result, {
    status: result.ok || result.mode === "not_configured" ? 200 : 502,
  });
}
