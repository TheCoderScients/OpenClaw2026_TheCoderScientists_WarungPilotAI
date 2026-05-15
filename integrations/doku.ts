import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PaymentTask } from "@/agent/types";

type DokuCheckoutResponse = {
  message?: string[];
  response?: {
    order?: {
      amount?: string;
      invoice_number?: string;
      session_id?: string;
    };
    payment?: {
      payment_method_types?: string[];
      payment_due_date?: number;
      token_id?: string;
      url?: string;
      expired_date?: string;
    };
    uuid?: string | number;
  };
  error_messages?: string[];
};

export type DokuCheckoutResult = {
  ok: boolean;
  mode: "sandbox" | "production" | "not_configured" | "error";
  detail: string;
  paymentUrl?: string;
  tokenId?: string;
  expiredDate?: string;
  requestId?: string;
  invoiceNumber: string;
};

export async function createDokuCheckout(
  payment: PaymentTask,
): Promise<DokuCheckoutResult> {
  const config = readDokuConfig();

  if (!config.clientId || !config.secretKey) {
    return {
      detail:
        "DOKU credentials are not configured. Fill DOKU_CLIENT_ID and DOKU_SECRET_KEY to create a sandbox checkout link.",
      invoiceNumber: payment.invoiceNumber,
      mode: "not_configured",
      ok: false,
    };
  }

  const requestTarget = "/checkout/v1/payment";
  const requestId = randomUUID();
  const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = createCheckoutBody(payment, config);
  const bodyText = JSON.stringify(body);
  const digest = createDigest(bodyText);
  const signature = createSignature({
    clientId: config.clientId,
    digest,
    requestId,
    requestTarget,
    requestTimestamp,
    secretKey: config.secretKey,
  });

  try {
    const response = await fetch(`${config.baseUrl}${requestTarget}`, {
      body: bodyText,
      headers: {
        "Client-Id": config.clientId,
        "Content-Type": "application/json",
        Digest: digest,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        Signature: signature,
      },
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as DokuCheckoutResponse;
    const paymentUrl = payload.response?.payment?.url;

    if (!response.ok || !paymentUrl) {
      return {
        detail:
          payload.error_messages?.join(", ") ||
          payload.message?.join(", ") ||
          `DOKU returned HTTP ${response.status}.`,
        invoiceNumber: payment.invoiceNumber,
        mode: "error",
        ok: false,
        requestId,
      };
    }

    return {
      detail: "DOKU Checkout payment URL created.",
      expiredDate: payload.response?.payment?.expired_date,
      invoiceNumber: payment.invoiceNumber,
      mode: config.mode,
      ok: true,
      paymentUrl,
      requestId,
      tokenId: payload.response?.payment?.token_id,
    };
  } catch (error) {
    return {
      detail: error instanceof Error ? error.message : "DOKU request failed.",
      invoiceNumber: payment.invoiceNumber,
      mode: "error",
      ok: false,
      requestId,
    };
  }
}

function readDokuConfig() {
  const mode: "sandbox" | "production" =
    process.env.DOKU_ENV?.trim() === "production" ? "production" : "sandbox";

  return {
    baseUrl:
      mode === "production"
        ? "https://api.doku.com"
        : "https://api-sandbox.doku.com",
    callbackUrl: process.env.DOKU_CALLBACK_URL?.trim(),
    clientId: process.env.DOKU_CLIENT_ID?.trim(),
    customerEmail:
      process.env.DOKU_DEMO_CUSTOMER_EMAIL?.trim() ||
      "customer@warungpilot.local",
    customerPhone: process.env.DOKU_DEMO_CUSTOMER_PHONE?.trim() || "628121212121",
    mode,
    paymentDueDate: Number.parseInt(
      process.env.DOKU_PAYMENT_DUE_MINUTES || "60",
      10,
    ),
    paymentMethods: parsePaymentMethods(process.env.DOKU_PAYMENT_METHOD_TYPES),
    secretKey: process.env.DOKU_SECRET_KEY?.trim(),
  };
}

function createCheckoutBody(
  payment: PaymentTask,
  config: ReturnType<typeof readDokuConfig>,
) {
  const order: Record<string, unknown> = {
    amount: payment.amount,
    auto_redirect: false,
    currency: "IDR",
    invoice_number: sanitizeInvoiceNumber(payment.invoiceNumber),
    line_items: [
      {
        category: "food-and-beverage",
        name: `WarungPilot order for ${payment.customer}`,
        price: payment.amount,
        quantity: 1,
        sku: payment.reference,
      },
    ],
  };

  if (config.callbackUrl) {
    order.callback_url_result = config.callbackUrl;
  }

  return {
    customer: {
      email: config.customerEmail,
      name: payment.customer,
      phone: config.customerPhone,
    },
    order,
    payment: {
      payment_due_date: Number.isFinite(config.paymentDueDate)
        ? config.paymentDueDate
        : 60,
      payment_method_types: config.paymentMethods,
    },
  };
}

function createDigest(bodyText: string) {
  return createHash("sha256").update(bodyText).digest("base64");
}

function createSignature({
  clientId,
  digest,
  requestId,
  requestTarget,
  requestTimestamp,
  secretKey,
}: {
  clientId: string;
  digest: string;
  requestId: string;
  requestTarget: string;
  requestTimestamp: string;
  secretKey: string;
}) {
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join("\n");
  const signature = createHmac("sha256", secretKey)
    .update(component)
    .digest("base64");

  return `HMACSHA256=${signature}`;
}

function parsePaymentMethods(value: string | undefined) {
  const methods = value
    ?.split(",")
    .map((method) => method.trim())
    .filter(Boolean);

  return methods?.length
    ? methods
    : ["QRIS", "VIRTUAL_ACCOUNT_BCA", "VIRTUAL_ACCOUNT_DOKU"];
}

function sanitizeInvoiceNumber(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
}
