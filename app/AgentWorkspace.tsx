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
        headers: {
          "Content-Type": "application/json",
        },
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

    if (!payment) {
      return;
    }

    setIsCreatingDoku(true);
    setDokuCheckout(null);

    try {
      const response = await fetch("/api/payments/doku/checkout", {
        body: JSON.stringify({ payment }),
        headers: {
          "Content-Type": "application/json",
        },
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

    if (!invoiceNumber) {
      return;
    }

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
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Agent input
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Customer messages</h2>
          </div>
          <button
            className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
            disabled={isRunning}
            onClick={runAgent}
            type="button"
          >
            {isRunning ? "Running agent..." : "Run agent"}
          </button>
        </div>
        <textarea
          className="mt-6 min-h-72 w-full resize-y rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-7 text-zinc-100 outline-none transition focus:border-emerald-300/60"
          onChange={(event) => setMessages(event.target.value)}
          value={messages}
        />
        {error ? (
          <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["Messages", metrics?.totalMessages ?? 0],
            ["Orders", metrics?.validOrders ?? 0],
            ["Revenue", `Rp${(metrics?.revenue ?? 0).toLocaleString("id-ID")}`],
            ["Approvals", metrics?.approvalsWaiting ?? 0],
          ].map(([label, value]) => (
            <div
              className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4"
              key={label}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Agent trace
          </p>
          <div className="mt-5 space-y-3">
            {(result?.plan ?? []).map((step) => (
              <div
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                key={step.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-semibold text-white">{step.agent}</h3>
                  <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    {step.tool}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{step.goal}</p>
                <p className="mt-2 text-sm text-zinc-200">{step.observation}</p>
              </div>
            ))}
            {!result ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                Run the agent to generate an auditable workflow trace.
              </p>
            ) : null}
          </div>
        </div>

        {result ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  Payment task
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-xl border border-emerald-300/30 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/10 disabled:opacity-60"
                    disabled={isCreatingDoku || !result.paymentTasks[0]}
                    onClick={createDokuCheckout}
                    type="button"
                  >
                    {isCreatingDoku ? "Creating..." : "Create DOKU Checkout"}
                  </button>
                  <button
                    className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-60"
                    disabled={isCheckingDoku || !result.paymentTasks[0]}
                    onClick={checkDokuStatus}
                    type="button"
                  >
                    {isCheckingDoku ? "Checking..." : "Check status"}
                  </button>
                </div>
              </div>
              <pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-100">
                {JSON.stringify(result.paymentTasks[0] ?? {}, null, 2)}
              </pre>
              {dokuCheckout ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-100">
                  <p className="font-semibold">
                    DOKU {dokuCheckout.mode}:{" "}
                    {dokuCheckout.ok ? "ready" : "not ready"}
                  </p>
                  <p className="mt-2 text-zinc-300">{dokuCheckout.detail}</p>
                  {dokuCheckout.requestId ? (
                    <p className="mt-2 font-mono text-xs text-zinc-500">
                      Request: {dokuCheckout.requestId}
                    </p>
                  ) : null}
                  {dokuCheckout.paymentUrl ? (
                    <a
                      className="mt-3 inline-flex text-emerald-200 underline"
                      href={dokuCheckout.paymentUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open DOKU payment page
                    </a>
                  ) : null}
                </div>
              ) : null}
              {dokuStatus ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-100">
                  <p className="font-semibold">
                    Payment status: {dokuStatus.status ?? "unknown"}
                  </p>
                  <p className="mt-2 text-zinc-300">{dokuStatus.detail}</p>
                  {dokuStatus.requestId ? (
                    <p className="mt-2 font-mono text-xs text-zinc-500">
                      Status request: {dokuStatus.requestId}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="rounded-3xl border border-indigo-400/30 bg-indigo-400/[0.06] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-indigo-200">
                Reflection
              </p>
              <p className="mt-4 text-sm leading-7 text-zinc-100">
                {result.reflection.autonomousTaskCompleted}
              </p>
              <p className="mt-4 text-sm text-zinc-400">
                Decision: {result.reflection.decision} | Risk:{" "}
                {result.reflection.riskScore}
              </p>
              {result.reflection.modelAssessment ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-zinc-100">
                  <p className="font-semibold">
                    Model: {result.reflection.modelAssessment.model}
                  </p>
                  <p className="text-zinc-400">
                    Provider: {result.reflection.modelAssessment.provider}
                  </p>
                  <p className="mt-2">
                    {result.reflection.modelAssessment.summary}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
