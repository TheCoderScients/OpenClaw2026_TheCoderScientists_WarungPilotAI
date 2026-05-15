export type CustomerIntent =
  | "buy"
  | "ask_price"
  | "complaint"
  | "discount"
  | "follow_up";

export type InventoryItem = {
  id: string;
  name: string;
  aliases: string[];
  price: number;
  stock: number;
  lowStockThreshold: number;
};

export type CustomerMessage = {
  id: string;
  customer: string;
  text: string;
  receivedAt: string;
};

export type AgentPlanStep = {
  id: string;
  agent:
    | "Planner Agent"
    | "Customer Intent Agent"
    | "Order Agent"
    | "Inventory Agent"
    | "Finance Agent"
    | "Payment Agent"
    | "Approval Agent"
    | "Reflection Agent"
    | "Memory Agent";
  goal: string;
  tool: string;
  status: "completed" | "skipped" | "needs_owner";
  observation: string;
};

export type IntentDecision = {
  customer: string;
  intent: CustomerIntent;
  confidence: number;
  reason: string;
};

export type OrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  availableStock: number;
  stockStatus: "available" | "low_stock" | "insufficient" | "unknown";
};

export type OrderDraft = {
  customer: string;
  status: "valid" | "needs_clarification" | "blocked";
  lines: OrderLine[];
  total: number;
  notes: string[];
};

export type InvoiceDraft = {
  invoiceNumber: string;
  customer: string;
  total: number;
  lines: OrderLine[];
  text: string;
};

export type PaymentTask = {
  id: string;
  customer: string;
  invoiceNumber: string;
  amount: number;
  reference: string;
  channel: "QRIS / transfer";
  status: "waiting_owner_approval";
  instruction: string;
  reconciliationNote: string;
};

export type ApprovalTask = {
  id: string;
  customer: string;
  intent: CustomerIntent;
  status: "waiting_owner_approval";
  suggestedReply: string;
  canSendWithoutOwner: false;
};

export type AgentReflection = {
  riskScore: number;
  missingInformation: string[];
  autonomousTaskCompleted: string;
  decision: "ready_for_owner_approval" | "needs_clarification" | "blocked";
  rationale: string;
  modelAssessment?: {
    provider: "local" | "openai-compatible" | "unavailable";
    model: string;
    summary: string;
  };
};

export type AgentRunInput = {
  messages: string;
  inventory?: InventoryItem[];
  storeName?: string;
};

export type AgentRunResult = {
  runId: string;
  createdAt: string;
  storeName: string;
  messages: CustomerMessage[];
  plan: AgentPlanStep[];
  intents: IntentDecision[];
  orders: OrderDraft[];
  invoices: InvoiceDraft[];
  paymentTasks: PaymentTask[];
  approvals: ApprovalTask[];
  reflection: AgentReflection;
  memory: {
    persisted: boolean;
    recordPath: string;
  };
  metrics: {
    totalMessages: number;
    validOrders: number;
    revenue: number;
    paymentTasks: number;
    approvalsWaiting: number;
  };
};
