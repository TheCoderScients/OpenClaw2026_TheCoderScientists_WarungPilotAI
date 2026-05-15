import { AgentWorkspace } from "@/app/AgentWorkspace";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1220px] flex-col gap-0 px-5 py-6">
      {/* ── Topbar ───────────────────────────────────────────────── */}
      <header className="flex items-center justify-between pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sm font-bold text-sky-400">
            W
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-white">
              WarungPilot AI
            </h1>
            <p className="text-[11px] text-[var(--text-muted)]">
              Autonomous Commerce Agent
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-success">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-emerald-400 pulse-dot" />
            System Online
          </span>
          <a
            className="btn-outline text-[11px]"
            href="/api/agent/run"
            target="_blank"
            rel="noreferrer"
          >
            API ↗
          </a>
        </div>
      </header>

      {/* ── Hero section ─────────────────────────────────────────── */}
      <section className="surface mb-5 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[22px] font-semibold tracking-tight text-white">
            Agent Workspace
          </p>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Process customer chats autonomously — from intent classification
            through invoicing to owner-approved payment instructions. The agent
            reasons, selects tools, and loops until all tasks are complete.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["Plan", "Decompose tasks"],
            ["Tools", "11 tool calls"],
            ["Reflect", "Risk scoring"],
            ["Gate", "Owner approval"],
          ].map(([label, sub]) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2.5"
            >
              <span className="text-[13px] font-semibold text-white">
                {label}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {sub}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Agent workspace ──────────────────────────────────────── */}
      <AgentWorkspace />
    </div>
  );
}
