import type { ApprovalTask, PaymentTask } from "@/agent/types";

type TelegramResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

export type TelegramApprovalPayload = {
  approval: ApprovalTask;
  payment?: PaymentTask;
  ownerChatId?: string;
};

export async function sendOwnerApproval({
  approval,
  ownerChatId,
  payment,
}: TelegramApprovalPayload): Promise<{
  ok: boolean;
  skipped: boolean;
  detail: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = ownerChatId?.trim() || process.env.TELEGRAM_OWNER_CHAT_ID?.trim();

  if (!token || !chatId) {
    return {
      detail:
        "Telegram token or owner chat ID is not configured; approval remains available in the cockpit.",
      ok: false,
      skipped: true,
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              callback_data: `approve:${approval.id}`,
              text: "Approve",
            },
            {
              callback_data: `reject:${approval.id}`,
              text: "Reject",
            },
          ],
        ],
      },
      text: createApprovalText(approval, payment),
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as TelegramResponse;

  return {
    detail: payload.ok
      ? "Approval sent to Telegram owner chat."
      : payload.description || `Telegram returned HTTP ${response.status}.`,
    ok: response.ok && payload.ok,
    skipped: false,
  };
}

function createApprovalText(approval: ApprovalTask, payment?: PaymentTask) {
  const lines = [
    "*WarungPilot AI approval*",
    "",
    `Customer: ${approval.customer}`,
    `Intent: ${approval.intent}`,
    `Status: ${approval.status}`,
  ];

  if (payment) {
    lines.push(
      "",
      `Payment: ${payment.amount}`,
      `Reference: ${payment.reference}`,
      `Channel: ${payment.channel}`,
    );
  }

  lines.push("", "Suggested reply:", approval.suggestedReply);

  return lines.join("\n");
}

