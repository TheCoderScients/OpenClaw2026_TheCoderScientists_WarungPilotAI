import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PaymentTask } from "@/agent/types";
import type {
  DokuCheckoutResult,
  DokuNotificationRecord,
  DokuPaymentStatusResult,
} from "@/integrations/doku";

type DokuLedgerEntry = {
  invoiceNumber: string;
  amount?: number;
  customer?: string;
  reference?: string;
  currentStatus?: string;
  checkouts: Array<{
    createdAt: string;
    detail: string;
    mode: string;
    ok: boolean;
    paymentUrl?: string;
    requestId?: string;
    tokenId?: string;
  }>;
  notifications: DokuNotificationRecord[];
  statusChecks: Array<DokuPaymentStatusResult & { checkedAt: string }>;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const LEDGER_PATH = path.join(DATA_DIR, "doku-payments.json");
const MAX_EVENTS = 30;

export async function recordDokuCheckout(
  payment: PaymentTask,
  result: DokuCheckoutResult,
) {
  await updateLedger(result.invoiceNumber, (entry) => ({
    ...entry,
    amount: payment.amount,
    customer: payment.customer,
    reference: payment.reference,
    checkouts: [
      {
        createdAt: new Date().toISOString(),
        detail: result.detail,
        mode: result.mode,
        ok: result.ok,
        paymentUrl: result.paymentUrl,
        requestId: result.requestId,
        tokenId: result.tokenId,
      },
      ...entry.checkouts,
    ].slice(0, MAX_EVENTS),
  }));
}

export async function recordDokuNotification(notification: DokuNotificationRecord) {
  const invoiceNumber = notification.invoiceNumber ?? "unknown-invoice";

  await updateLedger(invoiceNumber, (entry) => ({
    ...entry,
    amount: notification.amount ?? entry.amount,
    currentStatus: notification.status ?? entry.currentStatus,
    notifications: [notification, ...entry.notifications].slice(0, MAX_EVENTS),
  }));
}

export async function recordDokuStatus(result: DokuPaymentStatusResult) {
  await updateLedger(result.invoiceNumber, (entry) => ({
    ...entry,
    amount: result.amount ?? entry.amount,
    currentStatus: result.status ?? entry.currentStatus,
    statusChecks: [
      {
        ...result,
        checkedAt: new Date().toISOString(),
      },
      ...entry.statusChecks,
    ].slice(0, MAX_EVENTS),
  }));
}

async function updateLedger(
  invoiceNumber: string,
  updater: (entry: DokuLedgerEntry) => DokuLedgerEntry,
) {
  await mkdir(DATA_DIR, { recursive: true });
  const ledger = await readLedger();
  const existing = ledger[invoiceNumber] ?? createEmptyEntry(invoiceNumber);

  ledger[invoiceNumber] = updater(existing);

  await writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2), "utf8");
}

async function readLedger(): Promise<Record<string, DokuLedgerEntry>> {
  try {
    const content = await readFile(LEDGER_PATH, "utf8");
    const parsed = JSON.parse(content);

    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function createEmptyEntry(invoiceNumber: string): DokuLedgerEntry {
  return {
    checkouts: [],
    invoiceNumber,
    notifications: [],
    statusChecks: [],
  };
}
