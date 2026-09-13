import { describe, it, expect } from "vitest";
import { createServerSupabaseClient } from "@/lib/supabase/client";
import { callGemini, getCaseContext, getAgentActions, type AgentContext } from "@/lib/agent/gemini";

describe("Gemini integration", () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeAll(() => {
    supabase = createServerSupabaseClient();
  });

  it("returns a valid tool request for CASE001 (successful replacement)", async () => {
    const caseContext = await getCaseContext(supabase, "CASE001");
    const previousActions = await getAgentActions(supabase, "CASE001");

    const context: AgentContext = {
      caseId: "CASE001",
      customerMessage: caseContext.customerMessage,
      previousActions,
      iteration: 1,
    };

    const result = await callGemini(context);

    expect(result).toHaveProperty("tool");
    expect(result).toHaveProperty("args");
    expect(typeof result.tool).toBe("string");
    expect(typeof result.args).toBe("object");

    const validTools = [
      "get_customer",
      "get_order",
      "get_product",
      "get_inventory",
      "get_policy",
      "create_refund",
      "create_replacement",
      "cancel_order",
      "create_return",
      "verify_case",
    ];
    expect(validTools).toContain(result.tool);
  });

  it("returns a valid tool request for CASE002 (flagship replan: replacement unavailable → refund)", async () => {
    const caseContext = await getCaseContext(supabase, "CASE002");
    const previousActions = await getAgentActions(supabase, "CASE002");

    const context: AgentContext = {
      caseId: "CASE002",
      customerMessage: caseContext.customerMessage,
      previousActions,
      iteration: 1,
    };

    const result = await callGemini(context);

    expect(result).toHaveProperty("tool");
    expect(result).toHaveProperty("args");
    expect(typeof result.tool).toBe("string");
    expect(typeof result.args).toBe("object");
  });
});