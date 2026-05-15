import { NextResponse } from "next/server";
import { defaultMessages } from "@/agent/data";
import { runWarungPilotAgent } from "@/agent/runtime";
import type { AgentRunInput, InventoryItem } from "@/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runWarungPilotAgent({
    messages: defaultMessages,
  });

  return NextResponse.json(
    {
      ok: true,
      source: "warungpilot-agent",
      result,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = normalizeInput(body);
  const result = await runWarungPilotAgent(input);

  return NextResponse.json(
    {
      ok: true,
      source: "warungpilot-agent",
      result,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function normalizeInput(body: unknown): AgentRunInput {
  if (!isRecord(body)) {
    return {
      messages: defaultMessages,
    };
  }

  const messages =
    readString(body.messages) || readString(body.message) || defaultMessages;
  const storeName = readString(body.storeName) || undefined;
  const inventory = Array.isArray(body.inventory)
    ? body.inventory.filter(isInventoryItem)
    : undefined;

  return {
    inventory,
    messages,
    storeName,
  };
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string") &&
    typeof value.price === "number" &&
    typeof value.stock === "number" &&
    typeof value.lowStockThreshold === "number"
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

