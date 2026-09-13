"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AgentAction, Case } from "@/types";

const POLL_INTERVAL_MS = 2000;

function formatToolName(tool: string): string {
  return tool
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "success":
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full">✓ Success</span>;
    case "blocked":
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">⚠ Blocked</span>;
    case "error":
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">✗ Error</span>;
    default:
      return <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-full">{status}</span>;
  }
}

export default function ExecutionTimeline({ caseData, actions }: { caseData: Case; actions: AgentAction[] }) {
  const router = useRouter();
  const isTerminal = caseData.status === "resolved" || caseData.status === "escalated";

  // While the case is still running, re-render the server component to pick up new agent_actions.
  useEffect(() => {
    if (isTerminal) return;
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isTerminal, router]);

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b border-white/20 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Agent Execution: {caseData.id}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {caseData.customer_message}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                caseData.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                caseData.status === "escalated" ? "bg-red-100 text-red-700" :
                caseData.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                "bg-zinc-100 text-zinc-700"
              }`}>
                {caseData.status.toUpperCase()}
              </span>
              {!isTerminal && (
                <span className="flex items-center gap-1 text-sm text-blue-600 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Live
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="space-y-6">
          {/* Case Context */}
          <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Case Context</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-zinc-500">Customer ID:</span>
                <span className="ml-2 font-mono">{caseData.customer_id}</span>
              </div>
              <div>
                <span className="font-medium text-zinc-500">Order ID:</span>
                <span className="ml-2 font-mono">{caseData.order_id}</span>
              </div>
              <div>
                <span className="font-medium text-zinc-500">Status:</span>
                <span className="ml-2 capitalize">{caseData.status}</span>
              </div>
              <div>
                <span className="font-medium text-zinc-500">Created:</span>
                <span className="ml-2">{new Date(caseData.created_at ?? "").toLocaleString('en-US')}</span>
              </div>
            </div>
          </section>

          {/* Agent Actions Timeline */}
          <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800/50">
              <h2 className="text-lg font-semibold">Agent Activity Log</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Real-time view of the agent{"'"}s investigate → act → verify → replan loop
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {actions.length === 0 ? (
                <div className="p-16 flex flex-col items-center gap-4 text-zinc-500">
                  <div className="w-10 h-10 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                  <p className="text-sm font-medium">Agent is initializing…</p>
                </div>
              ) : (
                actions.map((action) => (
                  <div key={action.id} className="p-6 hover:bg-white/30 dark:hover:bg-zinc-900/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        action.status === "success" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700" :
                        action.status === "blocked" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700" :
                        "bg-zinc-100 dark:bg-zinc-800 text-zinc-600"
                      }`}>
                        {action.step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatToolName(action.tool)}
                          </span>
                          {getStatusBadge(action.status)}
                          <span className="ml-auto text-xs text-zinc-400">{new Date(action.timestamp).toLocaleTimeString('en-US')}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Input</span>
                            <pre className="mt-1 p-3 bg-black/5 dark:bg-white/5 rounded-lg text-xs font-mono overflow-x-auto max-h-36 border border-black/5 dark:border-white/10">{formatJson(action.input)}</pre>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Output</span>
                            <pre className="mt-1 p-3 bg-black/5 dark:bg-white/5 rounded-lg text-xs font-mono overflow-x-auto max-h-36 border border-black/5 dark:border-white/10">{formatJson(action.output)}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Resolution Summary (if terminal) */}
          {isTerminal && caseData.resolution && (() => {
            const res = caseData.resolution as Record<string, unknown>;
            const isResolved = caseData.status === "resolved";
            return (
              <section className={`rounded-2xl border p-6 shadow-xl backdrop-blur-md ${
                isResolved
                  ? "bg-emerald-50/70 dark:bg-emerald-950/50 border-emerald-200/50 dark:border-emerald-800/50"
                  : "bg-red-50/70 dark:bg-red-950/50 border-red-200/50 dark:border-red-800/50"
              }`}>
                <div className="flex items-center gap-3 mb-5">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                    isResolved ? "bg-emerald-100 dark:bg-emerald-900/60" : "bg-red-100 dark:bg-red-900/60"
                  }`}>
                    {isResolved ? "✅" : "⚠️"}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">{isResolved ? "Case Resolved" : "Case Escalated"}</h2>
                    <p className="text-sm text-zinc-500">{isResolved ? "All verification checks passed" : "Requires human review"}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  {!!res.action && (
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-white/30 dark:border-zinc-800/50">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">Action</dt>
                      <dd className="font-semibold capitalize">{String(res.action)}</dd>
                    </div>
                  )}
                  {!!res.new_order_id && (
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-white/30 dark:border-zinc-800/50">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">New Order</dt>
                      <dd className="font-mono font-semibold">{String(res.new_order_id)}</dd>
                    </div>
                  )}
                  {res.amount !== undefined && (
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-white/30 dark:border-zinc-800/50">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">Amount</dt>
                      <dd className="font-semibold">${Number(res.amount).toFixed(2)}</dd>
                    </div>
                  )}
                  {!!(res.replacement_status || res.refund_status || res.return_status) && (
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded-xl border border-white/30 dark:border-zinc-800/50">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">Status</dt>
                      <dd className="font-semibold capitalize">{String(res.replacement_status || res.refund_status || res.return_status)}</dd>
                    </div>
                  )}
                </dl>
              </section>
            );
          })()}

          {/* Navigation */}
          <div className="flex justify-center gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <a
              href={`/resolution/${caseData.id}`}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              View Resolution Details →
            </a>
            <a
              href="/case"
              className="px-6 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              New Case
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
