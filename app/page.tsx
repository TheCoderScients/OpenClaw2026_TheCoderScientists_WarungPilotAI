import { AgentWorkspace } from "@/app/AgentWorkspace";

const demoMessages = `[Ayu] Kak, risol mayo masih ada? Aku mau 2 risol mayo dan 1 es kopi, bisa dikirim sore ini?
[Bima] Harga risol mayo sama kopi susu berapa ya?
[Citra] Aku mau pesan 3 brownies dan 2 es kopi untuk besok pagi.
[Doni] Pesanan kemarin belum sampai, bisa dicek?`;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8">
      <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">
          Agent workspace
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">
              WarungPilot AI
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 md:text-lg">
              Autonomous commerce operations agent for Indonesian SMEs. It turns
              customer chats into orders, invoices, payment tasks, and
              owner-approved replies.
            </p>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:scale-[1.02] active:scale-95"
            href="/api/agent/run"
          >
            Run API demo
          </a>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Plan", "Create deterministic workflow steps"],
          ["Use Tools", "Inventory, invoice, payment, memory"],
          ["Reflect", "Score risk and missing information"],
          ["Act", "Prepare approval-gated customer reply"],
        ].map(([title, body]) => (
          <article
            className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5"
            key={title}
          >
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
                Customer input
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Incoming chats</h2>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              Demo payload
            </span>
          </div>
          <pre className="mt-6 whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/30 p-5 text-sm leading-7 text-zinc-200">
            {demoMessages}
          </pre>
        </div>

        <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/[0.06] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">
            Agent output
          </p>
          <h2 className="mt-2 text-2xl font-semibold">What gets submitted</h2>
          <ul className="mt-6 space-y-4 text-sm leading-6 text-zinc-300">
            <li>Structured order and stock decision.</li>
            <li>Invoice-ready total with payment reference.</li>
            <li>Risk reflection for ambiguous orders.</li>
            <li>Owner approval task before any customer-facing action.</li>
            <li>Memory record for demo trace and judging proof.</li>
          </ul>
        </div>
      </section>

      <AgentWorkspace />
    </main>
  );
}
