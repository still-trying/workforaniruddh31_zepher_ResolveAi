import { createServerSupabaseClient } from "@/lib/supabase/client";
import type { AgentAction, Case } from "@/types";
import ExecutionTimeline from "./execution-timeline";

export const dynamic = "force-dynamic";

export default async function ExecutionPage({ params }: { params: Promise<{ caseId: string }> }) {
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

  return (
    <ExecutionTimeline
      caseData={caseRes.data as Case}
      actions={(actionsRes.data ?? []) as AgentAction[]}
    />
  );
}
