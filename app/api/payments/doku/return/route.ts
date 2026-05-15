import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectUrl = new URL("/", url.origin);

  redirectUrl.searchParams.set("payment_return", "doku");

  return NextResponse.redirect(redirectUrl);
}
