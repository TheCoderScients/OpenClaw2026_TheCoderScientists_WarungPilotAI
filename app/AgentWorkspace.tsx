"use client";

import { useMemo, useState } from "react";
import { defaultMessages } from "@/agent/data";
import type { AgentRunResult } from "@/agent/types";

type AgentResponse = {
  ok: boolean;
  result: AgentRunResult;
};

type DokuCheckoutState = {
  ok: boolean;
  mode: string;
  detail: string;
  invoiceNumber: string;
  paymentUrl?: string;
  requestId?: string;
  tokenId?: string;
};

type DokuStatusState = {
  ok: boolean;
  mode: string;
  detail: string;
  invoiceNumber: string;
  amount?: number;
  requestId?: string;
  status?: string;
};

export function AgentWorkspace() {
  const [messages, setMessages] = useState(defaultMessages);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isCreatingDoku, setIsCreatingDoku] = useState(false);
  const [dokuCheckout, setDokuCheckout] = useState<DokuCheckoutState | null>(
    null,
  );
  const [dokuStatus, setDokuStatus] = useState<DokuStatusState | null>(null);
  const [isCheckingDoku, setIsCheckingDoku] = useState(false);
  const [error, setError] = useState("");
  const metrics = useMemo(() => result?.metrics, [result]);

  async function runAgent() {
    setIsRunning(true);
    setError("");

    try {
      const response = await fetch("/api/agent/run", {
        body: JSON.stringify({ messages }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as AgentResponse;

      if (!response.ok || !payload.ok) {
        throw new Error("Agent run failed.");
      }

      setResult(payload.result);
      setDokuCheckout(null);
      setDokuStatus(null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }

  async function createDokuCheckout() {
    const payment = result?.paymentTasks[0];
    if (!payment) return;
    setIsCreatingDoku(true);
    setDokuCheckout(null);

    try {
      const response = await fetch("/api/payments/doku/checkout", {
        body: JSON.stringify({ payment }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as DokuCheckoutState;
      setDokuCheckout(payload);
    } catch (checkoutError) {
      setDokuCheckout({
        detail:
          checkoutError instanceof Error
            ? checkoutError.message
            : "DOKU checkout request failed.",
        invoiceNumber: payment.invoiceNumber,
        mode: "error",
        ok: false,
      });
    } finally {
      setIsCreatingDoku(false);
    }
  }

  async function checkDokuStatus() {
    const invoiceNumber =
      dokuCheckout?.invoiceNumber ?? result?.paymentTasks[0]?.invoiceNumber;
    if (!invoiceNumber) return;
    setIsCheckingDoku(true);

    try {
      const response = await fetch(
        `/api/payments/doku/status/${encodeURIComponent(invoiceNumber)}`,
      );
      const payload = (await response.json()) as DokuStatusState;
      setDokuStatus(payload);
    } catch (statusError) {
      setDokuStatus({
        detail:
          statusError instanceof Error
            ? statusError.message
            : "DOKU status request failed.",
        invoiceNumber,
        mode: "error",
        ok: false,
      });
    } finally {
      setIsCheckingDoku(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      {/* ── Left: Input ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Input Messages
            </p>
            <span className="badge badge-muted">Demo</span>
          </div>
          <textarea
            className="input-area mt-3"
            onChange={(event) => setMessages(event.target.value)}
            value={messages}
          />
          <button
            className="btn-primary mt-3 w-full"
            disabled={isRunning}
            onClick={runAgent}
            type="button"
          >
            {isRunning ? (
              <>
                <span className="inline-block h-[6px] w-[6px] rounded-full bg-current pulse-dot" />
                Processing…
              </>
            ) : (
              "▶ Run Agent"
            )}
          </button>
          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-[12px] text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        {/* ── Metrics ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["Messages", metrics?.totalMessages ?? "—"],
              ["Valid Orders", metrics?.validOrders ?? "—"],
              [
                "Revenue",
                metrics
                  ? `Rp${metrics.revenue.toLocaleString("id-ID")}`
                  : "—",
              ],
              ["Approvals", metrics?.approvalsWaiting ?? "—"],
            ] as const
          ).map(([label, value]) => (
            <div className="metric-card" key={label}>
              <p className="metric-label">{label}</p>
              <p className="metric-value">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Reflection ───────────────────────────────────────── */}
        {result ? (
          <div className="surface p-4 animate-in">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Reflection
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`badge ${
                  result.reflection.decision === "ready_for_owner_approval"
                    ? "badge-success"
                    : result.reflection.decision === "blocked"
                      ? "bg-red-500/10 text-red-400"
                      : "badge-warn"
                }`}
              >
                {result.reflection.decision.replace(/_/g, " ")}
              </span>
              <span className="text-[12px] text-[var(--text-secondary)]">
                Risk: {result.reflection.riskScore}%
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {result.reflection.autonomousTaskCompleted}
            </p>
            {result.reflection.modelAssessment ? (
              <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {result.reflection.modelAssessment.model} ·{" "}
                  {result.reflection.modelAssessment.provider}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {result.reflection.modelAssessment.summary}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Right: Agent Trace + Payment ────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* ── Agent trace header ──────────────────────────────── */}
        <div className="surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Agent Trace
              </p>
              {result ? (
                <span
                  className={`badge ${result.autonomous ? "badge-accent" : "badge-muted"}`}
                >
                  {result.autonomous ? "⚡ Autonomous Loop" : "Sequential"}
                </span>
              ) : null}
            </div>
            {result ? (
              <span className="text-[11px] text-[var(--text-muted)]">
                {result.plan.length} steps
              </span>
            ) : null}
          </div>

          {/* ── Steps ──────────────────────────────────────────── */}
          <div className="mt-4 flex flex-col">
            {(result?.plan ?? []).map((step, idx) => (
              <div key={step.id} className="animate-in" style={{ animationDelay: `${idx * 40}ms` }}>
                {idx > 0 && <div className="step-connector" />}
                <div className="step-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-dim)] text-[10px] font-bold text-[var(--accent)]">
                        {idx + 1}
                      </span>
                      <span className="text-[13px] font-semibold text-white">
                        {step.agent}
                      </span>
                    </div>
                    <span className="badge badge-muted shrink-0">
                      {step.tool}
                    </span>
                  </div>
                  {result?.autonomous ? (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-sky-300/70">
                      💭 {step.goal}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
                      {step.goal}
                    </p>
                  )}
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    {step.observation}
                  </p>
                </div>
              </div>
            ))}
            {!result ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] py-12 text-center">
                <p className="text-[13px] text-[var(--text-muted)]">
                  Run the agent to see the autonomous workflow trace
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)] opacity-60">
                  The LLM will reason, select tools, and loop until complete
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Payment ──────────────────────────────────────────── */}
        {result && result.paymentTasks.length > 0 ? (
          <div className="surface p-4 animate-in">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Payment Task
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-outline"
                  disabled={isCreatingDoku || !result.paymentTasks[0]}
                  onClick={createDokuCheckout}
                  type="button"
                >
                  {isCreatingDoku ? "Creating…" : "DOKU Checkout"}
                </button>
                <button
                  className="btn-outline"
                  disabled={isCheckingDoku || !result.paymentTasks[0]}
                  onClick={checkDokuStatus}
                  type="button"
                >
                  {isCheckingDoku ? "Checking…" : "Status"}
                </button>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
              <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {JSON.stringify(result.paymentTasks[0], null, 2)}
              </pre>
            </div>
            {dokuCheckout ? (
              <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 animate-in">
                <div className="flex items-center gap-2">
                  <span className={`badge ${dokuCheckout.ok ? "badge-success" : "bg-red-500/10 text-red-400"}`}>
                    {dokuCheckout.mode}
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)]">
                    {dokuCheckout.ok ? "Ready" : "Not ready"}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                  {dokuCheckout.detail}
                </p>
                {dokuCheckout.requestId ? (
                  <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
                    ID: {dokuCheckout.requestId}
                  </p>
                ) : null}
                {dokuCheckout.paymentUrl ? (
                  <a
                    className="mt-2 inline-flex text-[12px] font-semibold text-sky-400 underline underline-offset-2"
                    href={dokuCheckout.paymentUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Payment Page ↗
                  </a>
                ) : null}
              </div>
            ) : null}
            {dokuStatus ? (
              <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 animate-in">
                <div className="flex items-center gap-2">
                  <span className="badge badge-muted">
                    {dokuStatus.status ?? "unknown"}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                  {dokuStatus.detail}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
