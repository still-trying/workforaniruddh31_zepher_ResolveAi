import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env.local") });

const url = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE!;

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Pin the delivery dates the claim window is measured from, so the scenarios stay deterministic
// no matter how long ago the database was seeded.
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Test all 5 scenarios
const scenarios = [
  {
    id: "CASE001",
    name: "Successful Replacement",
    message: "My espresso machine arrived damaged, the portafilter is cracked. I want a replacement.",
    setup: async () => {
      await supabase.from("orders").update({ status: "delivered", delivery_date: daysAgo(1) }).eq("id", "ORD002");
      await supabase.from("inventory").update({ available_quantity: 12 }).eq("product_id", "PROD002");
    }
  },
  {
    id: "CASE002",
    name: "Replacement Unavailable → Refund (Flagship Replan)",
    message: "My headphones arrived damaged. I want a replacement.",
    setup: async () => {
      await supabase.from("orders").update({ status: "delivered", delivery_date: daysAgo(1) }).eq("id", "ORD001");
      await supabase.from("inventory").update({ available_quantity: 0 }).eq("product_id", "PROD001");
    }
  },
  {
    id: "CASE003",
    name: "Cancellation Blocked → Alternative (Return)",
    message: "I need to cancel my running shoes order please.",
    setup: async () => {
      await supabase.from("orders").update({ status: "shipped", delivery_date: null, order_date: daysAgo(2) }).eq("id", "ORD003");
    }
  },
  {
    id: "CASE004",
    name: "Refund Approval (Premium Auto-approve)",
    message: "The smart watch is not what I expected. I would like a refund.",
    setup: async () => {
      await supabase.from("orders").update({ status: "delivered", delivery_date: daysAgo(2) }).eq("id", "ORD004");
    }
  },
  {
    id: "CASE005",
    name: "Claim Window Expired → Escalation",
    message: "The desk lamp stopped working. I want a replacement or my money back.",
    setup: async () => {
      await supabase.from("orders").update({ status: "delivered", delivery_date: daysAgo(30) }).eq("id", "ORD005");
    }
  }
];

const RUNS_PER_SCENARIO = 1;

async function main() {
  // Imported after env is loaded so the server-side clients see .env.local.
  const { runAgentLoop } = await import("@/lib/agent/loop");
  const { GeminiDailyQuotaExceededError } = await import("@/lib/agent/gemini");
  const totalRuns = scenarios.length * RUNS_PER_SCENARIO;
  let runsCompleted = 0;
  let allPassed = true;

  for (const scenario of scenarios) {
    for (let run = 1; run <= RUNS_PER_SCENARIO; run++) {
      console.log(`\n=== Testing ${scenario.name} (${scenario.id}) — Run ${run}/${RUNS_PER_SCENARIO} ===`);

      // Reset case
      await supabase.from("cases").update({ status: "open", resolution: null }).eq("id", scenario.id);
      await supabase.from("agent_actions").delete().eq("case_id", scenario.id);
      await scenario.setup();

      let result: Awaited<ReturnType<typeof runAgentLoop>>;
      try {
        result = await runAgentLoop(supabase, scenario.id, scenario.message);
      } catch (error) {
        if (error instanceof GeminiDailyQuotaExceededError) {
          // Abort rather than let the remaining runs fail and report meaningless outcomes: the
          // sweep cannot pass today, and a quota failure is indistinguishable from a real result
          // (a dead run "escalates", which would read as a valid outcome).
          console.error(`\n⛔ ABORTING SWEEP after ${runsCompleted}/${totalRuns} runs.`);
          console.error(`   ${error.message}`);
          console.error(`   No remaining run can succeed. Re-run when the quota resets, or use a key with more allowance.`);
          process.exit(1);
        }
        throw error;
      }
      runsCompleted++;

      console.log(`Result: ${result.status}`);
      console.log(`Resolution:`, JSON.stringify(result.resolution, null, 2));

      const { data: caseData } = await supabase.from("cases").select("*").eq("id", scenario.id).single();
      console.log(`Final case status: ${caseData?.status}`);

      const { data: actions } = await supabase.from("agent_actions").select("*").eq("case_id", scenario.id).order("step");
      console.log(`Actions: ${actions?.length} steps`);
      actions?.forEach(a => console.log(`  Step ${a.step}: ${a.tool} → ${a.status}`));

      // Check if scenario passed (resolved or expected escalation)
      const isCase005 = scenario.id === "CASE005"; // Expected to escalate
      const expectedStatus = isCase005 ? "escalated" : "resolved";
      if (caseData?.status !== expectedStatus) {
        console.error(`❌ FAIL: Expected ${expectedStatus}, got ${caseData?.status}`);
        allPassed = false;
      } else {
        console.log(`✅ PASS`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(allPassed ? "✅ All scenario runs passed" : "❌ Some scenario runs failed");
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
