import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { PaymentTask } from "@/agent/types";

type DokuMode = "sandbox" | "production";

type DokuCheckoutResponse = {
  message?: string[];
  response?: {
    order?: {
      amount?: string | number;
      callback_url?: string;
      invoice_number?: string;
      session_id?: string;
    };
    payment?: {
      expired_date?: string;
      payment_due_date?: number;
      payment_method_types?: string[];
      token_id?: string;
      url?: string;
    };
    uuid?: string | number;
  };
  error_messages?: string[];
};

type DokuStatusResponse = {
  message?: string[];
  response?: {
    order?: {
      amount?: string | number;
      invoice_number?: string;
      status?: string;
    };
    transaction?: {
      date?: string;
      original_request_id?: string;
      status?: string;
    };
  };
  error_messages?: string[];
  order?: {
    amount?: string | number;
    invoice_number?: string;
  };
  transaction?: {
    date?: string;
    original_request_id?: string;
    status?: string;
  };
};

export type DokuCheckoutResult = {
  ok: boolean;
  mode: DokuMode | "not_configured" | "error";
  detail: string;
  paymentUrl?: string;
  tokenId?: string;
  expiredDate?: string;
  requestId?: string;
  invoiceNumber: string;
  responseSignatureVerified?: boolean;
};

export type DokuPaymentStatusResult = {
  ok: boolean;
  mode: DokuMode | "not_configured" | "error";
  detail: string;
  invoiceNumber: string;
  amount?: number;
  requestId?: string;
  status?: string;
  transactionDate?: string;
  originalRequestId?: string;
};

export type DokuNotificationRecord = {
  amount?: number;
  channel?: string;
  invoiceNumber?: string;
  originalRequestId?: string;
  receivedAt: string;
  requestId: string;
  service?: string;
  status?: string;
  transactionDate?: string;
  raw: Record<string, unknown>;
};

type DokuConfig = {
  autoRedirect: boolean;
  baseUrl: string;
  callbackUrl?: string;
  clientId?: string;
  customerEmail: string;
  customerPhone: string;
  mode: DokuMode;
  notificationUrl?: string;
  paymentDueDate: number;
  paymentMethods: string[];
  secretKey?: string;
  webhookVerify: boolean;
};

type SignatureInput = {
  clientId: string;
  digest?: string;
  requestId: string;
  requestTarget: string;
  secretKey: string;
  timestamp: string;
  timestampHeader: "Request-Timestamp" | "Response-Timestamp";
};

export async function createDokuCheckout(
  payment: PaymentTask,
): Promise<DokuCheckoutResult> {
  const config = readDokuConfig();

  if (!config.clientId || !config.secretKey) {
    return {
      detail:
        "DOKU credentials are not configured. Fill DOKU_CLIENT_ID and DOKU_SECRET_KEY before creating a real checkout link.",
      invoiceNumber: payment.invoiceNumber,
      mode: "not_configured",
      ok: false,
    };
  }

  const requestTarget = "/checkout/v1/payment";
  const requestId = randomUUID();
  const requestTimestamp = createDokuTimestamp();
  const body = createCheckoutBody(payment, config);
  const bodyText = JSON.stringify(body);
  const digest = createDigest(bodyText);
  const signature = createDokuSignature({
    clientId: config.clientId,
    digest,
    requestId,
    requestTarget,
    secretKey: config.secretKey,
    timestamp: requestTimestamp,
    timestampHeader: "Request-Timestamp",
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
    const responseText = await response.text();
    const payload = safeJsonParse(responseText) as DokuCheckoutResponse;
    const paymentUrl = payload.response?.payment?.url;
    const responseSignatureVerified = verifyDokuResponseSignature({
      bodyText: responseText,
      clientId: config.clientId,
      headers: response.headers,
      requestId,
      requestTarget,
      secretKey: config.secretKey,
    });

    if (responseSignatureVerified === false) {
      return {
        detail: "DOKU response signature did not match.",
        invoiceNumber: payment.invoiceNumber,
        mode: "error",
        ok: false,
        requestId,
        responseSignatureVerified,
      };
    }

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
        responseSignatureVerified,
      };
    }

    return {
      detail:
        config.mode === "production"
          ? "Production DOKU Checkout payment URL created."
          : "Sandbox DOKU Checkout payment URL created.",
      expiredDate: payload.response?.payment?.expired_date,
      invoiceNumber: payment.invoiceNumber,
      mode: config.mode,
      ok: true,
      paymentUrl,
      requestId,
      responseSignatureVerified,
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

export async function checkDokuPaymentStatus(
  invoiceNumber: string,
): Promise<DokuPaymentStatusResult> {
  const config = readDokuConfig();
  const sanitizedInvoiceNumber = sanitizeInvoiceNumber(invoiceNumber);

  if (!config.clientId || !config.secretKey) {
    return {
      detail:
        "DOKU credentials are not configured. Fill DOKU_CLIENT_ID and DOKU_SECRET_KEY before checking payment status.",
      invoiceNumber: sanitizedInvoiceNumber,
      mode: "not_configured",
      ok: false,
    };
  }

  const requestTarget = `/orders/v1/status/${encodeURIComponent(
    sanitizedInvoiceNumber,
  )}`;
  const requestId = randomUUID();
  const requestTimestamp = createDokuTimestamp();
  const signature = createDokuSignature({
    clientId: config.clientId,
    requestId,
    requestTarget,
    secretKey: config.secretKey,
    timestamp: requestTimestamp,
    timestampHeader: "Request-Timestamp",
  });

  try {
    const response = await fetch(`${config.baseUrl}${requestTarget}`, {
      headers: {
        "Client-Id": config.clientId,
        "Request-Id": requestId,
        "Request-Timestamp": requestTimestamp,
        Signature: signature,
      },
      method: "GET",
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as DokuStatusResponse;
    const status =
      payload.response?.transaction?.status ?? payload.transaction?.status;
    const amount =
      parseAmount(payload.response?.order?.amount) ??
      parseAmount(payload.order?.amount);

    if (!response.ok) {
      return {
        detail:
          payload.error_messages?.join(", ") ||
          payload.message?.join(", ") ||
          `DOKU status API returned HTTP ${response.status}.`,
        invoiceNumber: sanitizedInvoiceNumber,
        mode: "error",
        ok: false,
        requestId,
      };
    }

    return {
      amount,
      detail: status
        ? `DOKU payment status is ${status}.`
        : "DOKU status API responded without a transaction status.",
      invoiceNumber: sanitizedInvoiceNumber,
      mode: config.mode,
      ok: true,
      originalRequestId:
        payload.response?.transaction?.original_request_id ??
        payload.transaction?.original_request_id,
      requestId,
      status,
      transactionDate:
        payload.response?.transaction?.date ?? payload.transaction?.date,
    };
  } catch (error) {
    return {
      detail:
        error instanceof Error ? error.message : "DOKU status request failed.",
      invoiceNumber: sanitizedInvoiceNumber,
      mode: "error",
      ok: false,
      requestId,
    };
  }
}

export function verifyDokuNotification({
  headers,
  rawBody,
  requestTarget,
}: {
  headers: Headers;
  rawBody: string;
  requestTarget: string;
}): { ok: boolean; detail: string; requestId?: string } {
  const config = readDokuConfig();

  if (!config.clientId || !config.secretKey) {
    return {
      detail: "DOKU credentials are not configured.",
      ok: false,
    };
  }

  if (!config.webhookVerify) {
    return {
      detail: "DOKU webhook verification is disabled by env.",
      requestId: headers.get("Request-Id") ?? undefined,
      ok: true,
    };
  }

  const clientId = headers.get("Client-Id");
  const requestId = headers.get("Request-Id");
  const requestTimestamp = headers.get("Request-Timestamp");
  const signature = headers.get("Signature");

  if (!clientId || !requestId || !requestTimestamp || !signature) {
    return {
      detail: "DOKU notification is missing required signature headers.",
      requestId: requestId ?? undefined,
      ok: false,
    };
  }

  if (clientId !== config.clientId) {
    return {
      detail: "DOKU notification Client-Id does not match this merchant.",
      requestId,
      ok: false,
    };
  }

  const expectedSignature = createDokuSignature({
    clientId,
    digest: createDigest(rawBody),
    requestId,
    requestTarget,
    secretKey: config.secretKey,
    timestamp: requestTimestamp,
    timestampHeader: "Request-Timestamp",
  });

  const verified = safeSignatureEqual(signature, expectedSignature);

  return {
    detail: verified
      ? "DOKU notification signature verified."
      : "DOKU notification signature did not match.",
    requestId,
    ok: verified,
  };
}

export function parseDokuNotification(
  rawBody: string,
  requestId: string,
): DokuNotificationRecord {
  const payload = safeJsonParse(rawBody);
  const record = isRecord(payload) ? payload : {};
  const order = isRecord(record.order) ? record.order : {};
  const transaction = isRecord(record.transaction) ? record.transaction : {};
  const service = isRecord(record.service) ? record.service : {};
  const channel = isRecord(record.channel) ? record.channel : {};

  return {
    amount: parseAmount(order.amount),
    channel: asString(channel.id),
    invoiceNumber: asString(order.invoice_number),
    originalRequestId: asString(transaction.original_request_id),
    raw: record,
    receivedAt: new Date().toISOString(),
    requestId,
    service: asString(service.id),
    status: asString(transaction.status),
    transactionDate: asString(transaction.date),
  };
}

export function readDokuConfig(): DokuConfig {
  const mode: DokuMode =
    process.env.DOKU_ENV?.trim() === "production" ? "production" : "sandbox";

  return {
    autoRedirect: process.env.DOKU_AUTO_REDIRECT?.trim() === "true",
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
    notificationUrl: process.env.DOKU_NOTIFICATION_URL?.trim(),
    paymentDueDate: Number.parseInt(
      process.env.DOKU_PAYMENT_DUE_MINUTES || "60",
      10,
    ),
    paymentMethods: parsePaymentMethods(process.env.DOKU_PAYMENT_METHOD_TYPES),
    secretKey: process.env.DOKU_SECRET_KEY?.trim(),
    webhookVerify: process.env.DOKU_WEBHOOK_VERIFY?.trim() !== "false",
  };
}

function createCheckoutBody(payment: PaymentTask, config: DokuConfig) {
  const order: Record<string, unknown> = {
    amount: payment.amount,
    auto_redirect: config.autoRedirect,
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
    order.callback_url = config.callbackUrl;
    order.callback_url_result = config.callbackUrl;
  }

  const body: Record<string, unknown> = {
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

  if (config.notificationUrl) {
    body.additional_info = {
      override_notification_url: config.notificationUrl,
    };
  }

  return body;
}

function createDigest(bodyText: string) {
  return createHash("sha256").update(bodyText).digest("base64");
}

function createDokuSignature({
  clientId,
  digest,
  requestId,
  requestTarget,
  secretKey,
  timestamp,
  timestampHeader,
}: SignatureInput) {
  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `${timestampHeader}:${timestamp}`,
    `Request-Target:${requestTarget}`,
    digest ? `Digest:${digest}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  const signature = createHmac("sha256", secretKey)
    .update(component)
    .digest("base64");

  return `HMACSHA256=${signature}`;
}

function verifyDokuResponseSignature({
  bodyText,
  clientId,
  headers,
  requestId,
  requestTarget,
  secretKey,
}: {
  bodyText: string;
  clientId: string;
  headers: Headers;
  requestId: string;
  requestTarget: string;
  secretKey: string;
}) {
  const responseTimestamp = headers.get("Response-Timestamp");
  const signature = headers.get("Signature");

  if (!responseTimestamp || !signature) {
    return undefined;
  }

  const expectedSignature = createDokuSignature({
    clientId,
    digest: createDigest(bodyText),
    requestId,
    requestTarget,
    secretKey,
    timestamp: responseTimestamp,
    timestampHeader: "Response-Timestamp",
  });

  return safeSignatureEqual(signature, expectedSignature);
}

function parsePaymentMethods(value: string | undefined) {
  const methods = value
    ?.split(",")
    .map((method) => method.trim())
    .filter(Boolean);

  return methods?.length
    ? methods
    : ["VIRTUAL_ACCOUNT_DOKU"];
}

function createDokuTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function sanitizeInvoiceNumber(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function safeSignatureEqual(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
