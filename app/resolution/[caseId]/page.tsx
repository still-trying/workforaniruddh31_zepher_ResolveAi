import { createServerSupabaseClient } from "@/lib/supabase/client";
import type { AgentAction, Case, VerificationCheck } from "@/types";

export const dynamic = "force-dynamic";

export interface ResolutionData {
  action?: string;
  new_order_id?: string;
  amount?: number;
  refund_status?: string;
  replacement_status?: string;
  return_status?: string;
  error?: string;
  checks?: VerificationCheck[];
  [key: string]: unknown;
}

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

function formatCheckName(check: string): string {
  return check
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ResolutionPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;

  // Server-side read: the browser never talks to Postgres (ARCHITECTURE.md Section 2).
  const supabase = createServerSupabaseClient();
  const [caseRes, actionsRes] = await Promise.all([
    supabase.from("cases").select("*").eq("id", caseId).single(),
    supabase.from("agent_actions").select("*").eq("case_id", caseId).order("step", { ascending: true }),
  ]);

  if (caseRes.error || !caseRes.data) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold">Case not found</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">No case with id {caseId}</p>
          <a href="/case" className="mt-6 inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            New Case
          </a>
        </div>
      </div>
    );
  }

  const caseData = caseRes.data as Case;
  const actions = (actionsRes.data ?? []) as AgentAction[];

  const isResolved = caseData.status === "resolved";
  const isEscalated = caseData.status === "escalated";
  const resolution = caseData.resolution as ResolutionData | null;

  // Extract verification checks from resolution if available
  const verificationChecks: VerificationCheck[] = Array.isArray(resolution?.checks)
    ? (resolution.checks as VerificationCheck[])
    : [];

  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b border-white/20 dark:border-zinc-800/50 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Resolution Summary: {caseData.id}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {caseData.customer_message}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isResolved ? "bg-emerald-100 text-emerald-700" :
              isEscalated ? "bg-red-100 text-red-700" :
              "bg-zinc-100 text-zinc-700"
            }`}>
              {caseData.status.toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-6">
          {/* Case Overview */}
          <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Case Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-zinc-500">Customer ID:</span>
                <span className="ml-2 font-mono">{caseData.customer_id}</span>
              </div>
              <div>
                <span className="font-medium text-zinc-500">Order ID:</span>
                <span className="ml-2 font-mono">{caseData.order_id}</span>
              </div>
              <div>
                <span className="font-medium text-zinc-500">Submitted:</span>
                <span className="ml-2">{new Date(caseData.created_at ?? "").toLocaleString('en-US')}</span>
              </div>
            </div>
          </section>

          {/* Requested vs Actual Outcome */}
          <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Outcome Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-zinc-500 mb-2">Customer Requested</h3>
                <p className="text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {caseData.customer_message}
                </p>
              </div>
              <div>
                <h3 className="font-medium text-zinc-500 mb-2">Actual Outcome</h3>
                <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {resolution ? (
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Action Taken</dt>
                        <dd className="font-medium capitalize">
                          {resolution.action === "replacement" ? "Replacement Created" :
                           resolution.action === "refund" ? "Refund Processed" :
                           resolution.action === "cancel" ? "Order Cancelled" :
                           resolution.action === "return" ? "Return Created" :
                           String(resolution.action)}
                        </dd>
                      </div>
                      {resolution.new_order_id && (
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">New Order ID</dt>
                          <dd className="font-mono">{resolution.new_order_id}</dd>
                        </div>
                      )}
                      {resolution.amount !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Amount</dt>
                          <dd className="font-medium">${Number(resolution.amount).toFixed(2)}</dd>
                        </div>
                      )}
                      {resolution.refund_status && (
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Refund Status</dt>
                          <dd className="font-medium capitalize">{resolution.refund_status}</dd>
                        </div>
                      )}
                      {resolution.replacement_status && (
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Replacement Status</dt>
                          <dd className="font-medium capitalize">{resolution.replacement_status}</dd>
                        </div>
                      )}
                      {resolution.return_status && (
                        <div className="flex justify-between">
                          <dt className="text-zinc-500">Return Status</dt>
                          <dd className="font-medium capitalize">{resolution.return_status}</dd>
                        </div>
                      )}
                      {resolution.error && (
                        <div className="flex justify-between text-red-600">
                          <dt className="text-zinc-500">Error</dt>
                          <dd>{resolution.error}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-zinc-500">No resolution data available</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Verification Checklist */}
          <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Verification Checklist</h2>
            {verificationChecks.length > 0 ? (
              <div className="space-y-3">
                {verificationChecks.map((check, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      check.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                    }`}>
                      {check.passed ? "✓" : "✗"}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatCheckName(check.check)}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">{check.detail}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      check.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}>
                      {check.passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500">No verification data available</p>
            )}
          </section>

          {/* Alternative Taken (if replan occurred) */}
          {actions.some(a => a.status === "blocked") && (
            <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 p-6 shadow-xl">
              <h2 className="text-lg font-semibold mb-4 text-amber-700">Alternative Path Taken</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                The agent{"'"}s original plan was blocked. It successfully replanned and executed an alternative resolution.
              </p>
              <div className="space-y-2">
                {actions
                  .filter(a => a.status === "blocked")
                  .map((blocked, idx) => (
                    <div key={idx} className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="font-medium text-amber-800 dark:text-amber-200">Blocked: {formatToolName(blocked.tool)}</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {JSON.stringify(blocked.output)}
                      </p>
                    </div>
                  ))}
                {actions
                  .filter(a => a.status === "success" && ["create_refund", "create_replacement", "cancel_order", "create_return"].includes(a.tool))
                  .map((success, idx) => (
                    <div key={idx} className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <p className="font-medium text-emerald-800 dark:text-emerald-200">Successful Alternative: {formatToolName(success.tool)}</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                        {JSON.stringify(success.output)}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Full Action Log */}
          <section className="bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-2xl border border-white/20 dark:border-zinc-800/50 overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800/50">
              <h2 className="text-lg font-semibold">Complete Agent Action Log</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                All steps in the investigate → act → verify → replan loop
              </p>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {actions.map((action) => (
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
              ))}
            </div>
          </section>

          {/* Navigation */}
          <div className="flex justify-center gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <a
              href="/case"
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              New Case
            </a>
            <a
              href={`/execution/${caseData.id}`}
              className="px-6 py-2 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              View Live Execution
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
