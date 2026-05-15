import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentRunResult } from "@/agent/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const MEMORY_PATH = path.join(DATA_DIR, "agent-memory.json");
const MAX_RECORDS = 50;

export async function rememberAgentRun(result: AgentRunResult): Promise<{
  persisted: boolean;
  recordPath: string;
}> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const previous = await readMemory();
    const next = [createMemoryRecord(result), ...previous].slice(0, MAX_RECORDS);

    await writeFile(MEMORY_PATH, JSON.stringify(next, null, 2), "utf8");

    return {
      persisted: true,
      recordPath: MEMORY_PATH,
    };
  } catch {
    return {
      persisted: false,
      recordPath: MEMORY_PATH,
    };
  }
}

async function readMemory(): Promise<unknown[]> {
  try {
    const content = await readFile(MEMORY_PATH, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createMemoryRecord(result: AgentRunResult) {
  return {
    runId: result.runId,
    createdAt: result.createdAt,
    storeName: result.storeName,
    metrics: result.metrics,
    reflection: result.reflection,
    approvals: result.approvals.map((approval) => ({
      id: approval.id,
      customer: approval.customer,
      status: approval.status,
    })),
  };
}

