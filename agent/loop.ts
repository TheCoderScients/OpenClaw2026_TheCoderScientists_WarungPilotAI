import { randomUUID } from "node:crypto";
import { runAgentStep } from "@/agent/ai";
import {
  type LoopContext,
  type ToolResult,
  allTools,
  buildToolDescriptions,
  createLoopContext,
  findTool,
} from "@/agent/tool-registry";
import type {
  AgentPlanStep,
  AgentRunInput,
  AgentRunResult,
  LoopStep,
} from "@/agent/types";

const MAX_ITERATIONS = 30;
const FINISH_ACTION = "FINISH";

/* ------------------------------------------------------------------ */
/*  System prompt                                                     */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(): string {
  return `You are WarungPilot AI, an autonomous commerce operations agent for Indonesian SMEs (UMKM).

YOUR MISSION: Process incoming customer chat messages and autonomously complete ALL commerce operations — parsing messages, classifying intents, extracting orders, checking inventory, generating invoices, creating payment tasks, and setting up owner approval gates.

WORKFLOW GUIDELINES:
1. ALWAYS start by calling parse_messages to identify all customers.
2. You may call get_inventory to see available products.
3. For EACH customer, follow this pattern:
   a. classify_intent — understand what the customer wants
   b. extract_order — extract products and quantities, check stock
   c. generate_invoice — ONLY if order status is "valid"
   d. create_payment_task — ONLY if invoice was generated
   e. create_approval_task — for EVERY customer (even without orders)
4. Optionally call send_telegram_approval for important approvals.
5. After processing ALL customers, call reflect_on_run.
6. Finally, call save_to_memory.
7. Then use action "FINISH" to end.

SAFETY RULES:
- NEVER bypass the owner approval gate.
- NEVER invent prices; only use inventory data.
- NEVER send payment details before approval.
- Create approval tasks for ALL customers, even complaints or price inquiries.

AVAILABLE TOOLS:

${buildToolDescriptions()}

RESPONSE FORMAT — respond with ONLY a JSON object (no markdown, no extra text):
{
  "thought": "Your reasoning about what to do next and why",
  "action": "tool_name_here",
  "action_input": { "param": "value" }
}

When ALL tasks are complete (all customers processed, reflected, memory saved):
{
  "thought": "Summary of what was accomplished",
  "action": "FINISH",
  "action_input": { "summary": "..." }
}`;
}

/* ------------------------------------------------------------------ */
/*  Parse LLM response                                                */
/* ------------------------------------------------------------------ */

type ParsedAction = {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
};

function parseLlmResponse(raw: string): ParsedAction | null {
  const trimmed = raw.trim();

  /* Try direct JSON parse */
  const parsed = tryParseJson(trimmed);
  if (parsed) return parsed;

  /* Try extracting JSON from markdown code fences */
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = tryParseJson(fenceMatch[1].trim());
    if (inner) return inner;
  }

  /* Try finding first { ... } block */
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    const inner = tryParseJson(trimmed.slice(braceStart, braceEnd + 1));
    if (inner) return inner;
  }

  return null;
}

function tryParseJson(text: string): ParsedAction | null {
  try {
    const obj = JSON.parse(text);
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.thought === "string" &&
      typeof obj.action === "string"
    ) {
      return {
        thought: obj.thought,
        action: obj.action,
        actionInput:
          typeof obj.action_input === "object" && obj.action_input !== null
            ? obj.action_input
            : {},
      };
    }
  } catch {
    /* not valid JSON */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Main autonomous loop                                              */
/* ------------------------------------------------------------------ */

export async function runAutonomousLoop(
  input: Partial<AgentRunInput> = {},
): Promise<{
  result: AgentRunResult;
  loopTrace: LoopStep[];
  autonomous: boolean;
}> {
  const ctx = createLoopContext(
    input.messages || "",
    input.storeName || "",
    input.inventory,
  );

  const systemPrompt = buildSystemPrompt();
  const scratchpad: Array<{ role: "user" | "assistant"; content: string }> = [];
  const loopTrace: LoopStep[] = [];
  const planSteps: AgentPlanStep[] = [];

  /* Initial user message */
  scratchpad.push({
    role: "user",
    content: `Process these customer messages for store "${ctx.storeName}":\n\n${ctx.rawMessages}\n\nBegin the autonomous workflow now. Start with parse_messages.`,
  });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stepStart = Date.now();

    /* Call LLM */
    const llmResponse = await runAgentStep({
      systemPrompt,
      messages: scratchpad,
    });

    if (!llmResponse) {
      /* LLM unavailable — add a note and stop */
      loopTrace.push({
        iteration: i + 1,
        thought: "LLM unavailable, autonomous loop cannot continue.",
        action: "ERROR",
        actionInput: {},
        observation: "AI provider did not respond.",
        durationMs: Date.now() - stepStart,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    /* Parse the response */
    const parsed = parseLlmResponse(llmResponse);
    if (!parsed) {
      /* Bad response — tell the LLM to fix format and retry */
      scratchpad.push({ role: "assistant", content: llmResponse });
      scratchpad.push({
        role: "user",
        content:
          "ERROR: Your response was not valid JSON. Respond with ONLY a JSON object with fields: thought, action, action_input. No markdown, no extra text.",
      });
      loopTrace.push({
        iteration: i + 1,
        thought: "(invalid response format)",
        action: "FORMAT_ERROR",
        actionInput: {},
        observation: `Raw: ${llmResponse.slice(0, 200)}`,
        durationMs: Date.now() - stepStart,
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    /* Check for FINISH */
    if (parsed.action === FINISH_ACTION) {
      scratchpad.push({
        role: "assistant",
        content: JSON.stringify({
          thought: parsed.thought,
          action: FINISH_ACTION,
          action_input: parsed.actionInput,
        }),
      });
      loopTrace.push({
        iteration: i + 1,
        thought: parsed.thought,
        action: FINISH_ACTION,
        actionInput: parsed.actionInput,
        observation: "Agent loop completed.",
        durationMs: Date.now() - stepStart,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    /* Find and execute tool */
    const tool = findTool(parsed.action);
    let toolResult: ToolResult;

    if (!tool) {
      toolResult = {
        ok: false,
        data: null,
        summary: `Unknown tool "${parsed.action}". Available tools: ${allTools.map((t) => t.name).join(", ")}.`,
      };
    } else {
      try {
        toolResult = await tool.execute(parsed.actionInput, ctx);
      } catch (err) {
        toolResult = {
          ok: false,
          data: null,
          summary: `Tool error: ${err instanceof Error ? err.message : "Unknown error"}.`,
        };
      }
    }

    /* Record in scratchpad */
    scratchpad.push({
      role: "assistant",
      content: JSON.stringify({
        thought: parsed.thought,
        action: parsed.action,
        action_input: parsed.actionInput,
      }),
    });
    scratchpad.push({
      role: "user",
      content: `Observation: ${JSON.stringify(toolResult.data)}\nSummary: ${toolResult.summary}`,
    });

    /* Record in loop trace */
    loopTrace.push({
      iteration: i + 1,
      thought: parsed.thought,
      action: parsed.action,
      actionInput: parsed.actionInput,
      observation: toolResult.summary,
      durationMs: Date.now() - stepStart,
      timestamp: new Date().toISOString(),
    });

    /* Record as plan step */
    const agentLabel = tool?.agentLabel ?? "Autonomous Agent";
    planSteps.push({
      id: `loop-${i + 1}`,
      agent: agentLabel,
      goal: parsed.thought,
      tool: parsed.action,
      status: parsed.action === "create_approval_task" ? "needs_owner" : "completed",
      observation: toolResult.summary,
    });
  }

  /* Build final result */
  const runId = randomUUID();
  const validOrders = ctx.orders.filter((o) => o.status === "valid");

  const result: AgentRunResult = {
    runId,
    createdAt: new Date().toISOString(),
    storeName: ctx.storeName,
    messages: ctx.messages,
    plan: planSteps,
    intents: ctx.intents,
    orders: ctx.orders,
    invoices: ctx.invoices,
    paymentTasks: ctx.paymentTasks,
    approvals: ctx.approvals,
    reflection: {
      riskScore: ctx.reflection?.riskScore ?? 0,
      missingInformation: ctx.reflection?.missingInformation ?? [],
      autonomousTaskCompleted:
        "Autonomously processed customer chats through ReAct-style agent loop: intent classification, order extraction, invoicing, payment task creation, and owner-approval gating — all without manual intervention.",
      decision:
        (ctx.reflection?.decision as
          | "ready_for_owner_approval"
          | "needs_clarification"
          | "blocked") ?? "ready_for_owner_approval",
      rationale: ctx.reflection?.rationale ?? "",
    },
    memory: ctx.memory ?? {
      persisted: false,
      recordPath: ".data/agent-memory.json",
    },
    metrics: {
      totalMessages: ctx.messages.length,
      validOrders: validOrders.length,
      revenue: ctx.invoices.reduce((s, i) => s + i.total, 0),
      paymentTasks: ctx.paymentTasks.length,
      approvalsWaiting: ctx.approvals.length,
    },
    loopTrace,
    autonomous: true,
  };

  return { result, loopTrace, autonomous: true };
}
