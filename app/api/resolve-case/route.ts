import { createClient } from "@supabase/supabase-js";
import { runAgentLoop } from "@/lib/agent/loop";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { case_id, customer_message } = body;

    if (!case_id || !customer_message) {
      return Response.json({ error: "case_id and customer_message are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE!;
    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existingCase } = await supabase.from("cases").select("id").eq("id", case_id).single();
    
    if (!existingCase) {
      const { customer_id, order_id } = body;
      if (!customer_id || !order_id) {
        return Response.json({ error: "customer_id and order_id are required to register a new case" }, { status: 400 });
      }

      const { error: insertError } = await supabase.from("cases").insert({
        id: case_id,
        customer_id,
        order_id,
        customer_message,
        status: "open",
        resolution: null,
      });

      if (insertError) {
        if (insertError.message.includes("foreign key constraint")) {
          return Response.json(
            { error: "The Customer ID or Order ID provided does not exist in the database. Please use valid IDs (e.g., CUST001 and ORD001)." },
            { status: 400 }
          );
        }
        return Response.json({ error: "Failed to register new case: " + insertError.message }, { status: 500 });
      }
    }

    const result = await runAgentLoop(supabase, case_id, customer_message);

    return Response.json(result);
  } catch (error) {
    console.error("[resolve-case] Error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
