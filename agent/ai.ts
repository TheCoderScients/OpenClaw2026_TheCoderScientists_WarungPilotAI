import type { AgentRunResult } from "@/agent/types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function getModelAssessment(
  partial: Pick<
    AgentRunResult,
    "messages" | "orders" | "invoices" | "paymentTasks" | "metrics"
  >,
): Promise<{
  provider: "kiro" | "local" | "openai-compatible" | "unavailable";
  model: string;
  summary: string;
}> {
  const provider = process.env.AI_PROVIDER?.trim() || "local";

  if (provider === "none" || provider === "mock") {
    return unavailable("AI provider disabled for deterministic demo.");
  }

  const config =
    provider === "kiro" || provider === "9router"
      ? {
          apiKey:
            process.env.KIRO_API_KEY?.trim() ||
            process.env.NINE_ROUTER_API_KEY?.trim() ||
            process.env.OPENAI_API_KEY?.trim() ||
            "9router",
          baseUrl:
            process.env.KIRO_BASE_URL?.trim() ||
            process.env.NINE_ROUTER_BASE_URL?.trim() ||
            "http://127.0.0.1:20128/v1",
          model:
            process.env.KIRO_MODEL?.trim() ||
            process.env.NINE_ROUTER_MODEL?.trim() ||
            "kr/claude-sonnet-4.5",
          provider: "kiro" as const,
        }
      : provider === "openai"
        ? {
            apiKey: process.env.OPENAI_API_KEY?.trim(),
            baseUrl: process.env.OPENAI_BASE_URL?.trim(),
            model: process.env.OPENAI_MODEL?.trim(),
            provider: "openai-compatible" as const,
        }
      : {
          apiKey: process.env.LOCAL_AI_API_KEY?.trim() || "ollama",
          baseUrl:
            process.env.LOCAL_AI_BASE_URL?.trim() ||
            "http://127.0.0.1:11434/v1",
          model: process.env.LOCAL_AI_MODEL?.trim() || "qwen3:1.7b",
          provider: "local" as const,
        };

  if (!config.baseUrl || !config.model) {
    return unavailable("AI provider is not configured.");
  }

  try {
    const content = await requestChatCompletion({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      prompt: createAssessmentPrompt(partial),
    });

    return {
      provider: config.provider,
      model: config.model,
      summary:
        content ||
        "Model responded without content; deterministic agent output remains valid.",
    };
  } catch (error) {
    return unavailable(
      error instanceof Error
        ? error.message
        : "Model assessment failed for an unknown reason.",
    );
  }
}

async function requestChatCompletion({
  apiKey,
  baseUrl,
  model,
  prompt,
}: {
  apiKey?: string;
  baseUrl: string;
  model: string;
  prompt: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          {
            content:
              "You are a risk reviewer for an autonomous SME commerce agent. Keep the answer under 50 words.",
            role: "system",
          },
          {
            content: prompt,
            role: "user",
          },
        ],
        model,
        stream: false,
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${apiKey || "ollama"}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI model returned ${response.status}`);
    }

    const text = await response.text();
    return parseChatCompletionText(text);
  } finally {
    clearTimeout(timeout);
  }
}

function parseChatCompletionText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("data:")) {
    return parseServerSentEvents(trimmed);
  }

  try {
    const payload = JSON.parse(trimmed) as ChatCompletionResponse;
    return payload.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return trimmed;
  }
}

function parseServerSentEvents(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]")
    .map((line) => {
      try {
        const payload = JSON.parse(line) as {
          choices?: Array<{
            delta?: {
              content?: string;
            };
            message?: {
              content?: string;
            };
          }>;
        };

        return (
          payload.choices?.[0]?.delta?.content ||
          payload.choices?.[0]?.message?.content ||
          ""
        );
      } catch {
        return "";
      }
    })
    .join("")
    .trim();
}

function createAssessmentPrompt(
  partial: Pick<
    AgentRunResult,
    "messages" | "orders" | "invoices" | "paymentTasks" | "metrics"
  >,
) {
  return JSON.stringify({
    ask: "Assess whether the agent output is safe to send to owner approval.",
    metrics: partial.metrics,
    messages: partial.messages.map((message) => ({
      customer: message.customer,
      text: message.text,
    })),
    orders: partial.orders.map((order) => ({
      customer: order.customer,
      status: order.status,
      total: order.total,
      notes: order.notes,
    })),
    invoices: partial.invoices.map((invoice) => ({
      customer: invoice.customer,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total,
    })),
    paymentTasks: partial.paymentTasks.map((task) => ({
      customer: task.customer,
      amount: task.amount,
      reference: task.reference,
      status: task.status,
    })),
  });
}

function unavailable(summary: string) {
  return {
    provider: "unavailable" as const,
    model: "deterministic-agent",
    summary,
  };
}
