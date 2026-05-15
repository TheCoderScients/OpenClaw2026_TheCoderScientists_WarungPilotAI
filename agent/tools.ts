import { defaultInventory } from "@/agent/data";
import type {
  ApprovalTask,
  CustomerIntent,
  CustomerMessage,
  IntentDecision,
  InventoryItem,
  InvoiceDraft,
  OrderDraft,
  OrderLine,
  PaymentTask,
} from "@/agent/types";

export function parseCustomerMessages(input: string): CustomerMessage[] {
  const now = new Date().toISOString();

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^\[([^\]]+)]\s*(.+)$/);
      const customer = match?.[1]?.trim() || `Customer ${index + 1}`;
      const text = match?.[2]?.trim() || line;

      return {
        id: `msg-${index + 1}`,
        customer,
        text,
        receivedAt: now,
      };
    });
}

export function normalizeInventory(
  inventory: InventoryItem[] | undefined,
): InventoryItem[] {
  return inventory?.length ? inventory : defaultInventory;
}

export function detectIntent(message: CustomerMessage): IntentDecision {
  const text = message.text.toLowerCase();
  const intent: CustomerIntent = text.match(/komplain|belum sampai|rusak|salah/)
    ? "complaint"
    : text.match(/diskon|nego|murah|potongan/)
      ? "discount"
      : text.match(/harga|berapa/)
        ? "ask_price"
        : text.match(/mau|pesan|beli|order|ambil/)
          ? "buy"
          : "follow_up";

  const confidence =
    intent === "buy" || intent === "ask_price" || intent === "complaint"
      ? 0.86
      : 0.72;

  return {
    customer: message.customer,
    intent,
    confidence,
    reason: createIntentReason(intent),
  };
}

export function draftOrder(
  message: CustomerMessage,
  inventory: InventoryItem[],
): OrderDraft {
  const lines = extractOrderLines(message.text, inventory);
  const notes: string[] = [];

  if (!lines.length) {
    return {
      customer: message.customer,
      status: "needs_clarification",
      lines,
      total: 0,
      notes: ["No concrete product and quantity detected."],
    };
  }

  for (const line of lines) {
    if (line.stockStatus === "insufficient") {
      notes.push(`${line.productName} stock is not enough for this order.`);
    }

    if (line.stockStatus === "low_stock") {
      notes.push(`${line.productName} is low stock after this order.`);
    }
  }

  const status = lines.some((line) => line.stockStatus === "insufficient")
    ? "blocked"
    : "valid";

  return {
    customer: message.customer,
    status,
    lines,
    total: lines.reduce((sum, line) => sum + line.subtotal, 0),
    notes,
  };
}

export function createInvoice(order: OrderDraft, sequence: number): InvoiceDraft {
  const invoiceNumber = `INV-WP-${String(sequence).padStart(4, "0")}`;
  const itemText = order.lines
    .map(
      (line) =>
        `${line.quantity}x ${line.productName} @ ${formatRupiah(line.unitPrice)} = ${formatRupiah(line.subtotal)}`,
    )
    .join("\n");

  return {
    invoiceNumber,
    customer: order.customer,
    total: order.total,
    lines: order.lines,
    text: [
      `Invoice ${invoiceNumber}`,
      `Customer: ${order.customer}`,
      itemText,
      `Total: ${formatRupiah(order.total)}`,
    ].join("\n"),
  };
}

export function createPaymentTask(invoice: InvoiceDraft): PaymentTask {
  const reference = invoice.invoiceNumber.replace("INV-", "PAY-");

  return {
    id: `pay-${invoice.invoiceNumber.toLowerCase()}`,
    customer: invoice.customer,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.total,
    reference,
    channel: "QRIS / transfer",
    status: "waiting_owner_approval",
    instruction: `After owner approval, ask ${invoice.customer} to pay ${formatRupiah(invoice.total)} via QRIS / transfer with reference ${reference}.`,
    reconciliationNote: `Match the exact amount ${formatRupiah(invoice.total)} and reference ${reference} before marking the order as paid.`,
  };
}

export function createApprovalTask({
  intent,
  invoice,
  order,
  payment,
}: {
  intent: IntentDecision;
  invoice?: InvoiceDraft;
  order: OrderDraft;
  payment?: PaymentTask;
}): ApprovalTask {
  const suggestedReply =
    invoice && payment
      ? `Halo ${order.customer}, pesanan kamu sudah kami catat. Totalnya ${formatRupiah(invoice.total)}. Setelah owner approve, pembayaran bisa via QRIS/transfer dengan kode ${payment.reference}.`
      : `Halo ${order.customer}, kami perlu konfirmasi detail pesanan dulu supaya tidak salah proses.`;

  return {
    id: `approval-${order.customer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    customer: order.customer,
    intent: intent.intent,
    status: "waiting_owner_approval",
    suggestedReply,
    canSendWithoutOwner: false,
  };
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function extractOrderLines(
  text: string,
  inventory: InventoryItem[],
): OrderLine[] {
  const normalized = text.toLowerCase();
  const lines: OrderLine[] = [];

  for (const item of inventory) {
    const alias = item.aliases.find((candidate) =>
      normalized.includes(candidate.toLowerCase()),
    );

    if (!alias) {
      continue;
    }

    const quantity = extractQuantityNearAlias(normalized, alias) ?? 1;
    const subtotal = quantity * item.price;
    const remainingStock = item.stock - quantity;
    const stockStatus =
      item.stock < quantity
        ? "insufficient"
        : remainingStock <= item.lowStockThreshold
          ? "low_stock"
          : "available";

    lines.push({
      productId: item.id,
      productName: item.name,
      quantity,
      unitPrice: item.price,
      subtotal,
      availableStock: item.stock,
      stockStatus,
    });
  }

  return lines;
}

function extractQuantityNearAlias(text: string, alias: string): number | null {
  const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const beforePattern = new RegExp(`(\\d+)\\s*(?:x|pcs|pc|buah|porsi|)?\\s*${escapedAlias}`);
  const afterPattern = new RegExp(`${escapedAlias}\\s*(\\d+)`);
  const before = text.match(beforePattern);
  const after = text.match(afterPattern);
  const raw = before?.[1] || after?.[1];

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function createIntentReason(intent: CustomerIntent): string {
  const reasons: Record<CustomerIntent, string> = {
    ask_price: "Customer asks about product price or availability.",
    buy: "Customer expresses buying intent with product mentions.",
    complaint: "Customer reports an issue that needs follow-up.",
    discount: "Customer asks for discount or negotiation.",
    follow_up: "Customer message needs a human-readable follow-up.",
  };

  return reasons[intent];
}

