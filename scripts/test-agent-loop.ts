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

async function main() {
  // Imported after env is loaded so the server-side clients see .env.local.
  const { runAgentLoop } = await import("@/lib/agent/loop");

  console.log("Testing agent loop with CASE001 (successful replacement)...");

  await supabase.from("cases").update({ status: "open", resolution: null }).eq("id", "CASE001");
  await supabase.from("agent_actions").delete().eq("case_id", "CASE001");
  await supabase.from("orders").update({ status: "delivered" }).eq("id", "ORD002");
  await supabase.from("inventory").update({ available_quantity: 12 }).eq("product_id", "PROD002");

  const result = await runAgentLoop(supabase, "CASE001", "My espresso machine arrived damaged, the portafilter is cracked. I want a replacement.");

  console.log("Result:", JSON.stringify(result, null, 2));

  const { data: caseData } = await supabase.from("cases").select("*").eq("id", "CASE001").single();
  console.log("Final case:", caseData);

  const { data: actions } = await supabase.from("agent_actions").select("*").eq("case_id", "CASE001").order("step");
  console.log("Actions:", actions);
}

main().catch(console.error);
