import type { SupabaseClient } from "@supabase/supabase-js";
import { callGemini, getAgentActions, GeminiDailyQuotaExceededError, type AgentContext, MAX_ITERATIONS } from "./gemini";
import { getCustomer } from "@/lib/tools/get-customer";
import { getOrder } from "@/lib/tools/get-order";
import { getProduct } from "@/lib/tools/get-product";
import { getInventory } from "@/lib/tools/get-inventory";
import { getPolicy } from "@/lib/tools/get-policy";
import { createRefund } from "@/lib/tools/create-refund";
import { createReplacement } from "@/lib/tools/create-replacement";
import { cancelOrder } from "@/lib/tools/cancel-order";
import { createReturn } from "@/lib/tools/create-return";
import { verifyCase } from "@/lib/tools/verify-case";

/**
 * The one and only agent loop (ARCHITECTURE.md Section 5). The Next route handler, the Supabase
 * Edge Function, and the CLI scripts all call this, so resolve/verify/log behaviour cannot drift
 * between entry points again.
 */

type ToolStatus = "success" | "blocked" | "error";

interface ToolResult {
  status: ToolStatus;
  output: Record<string, unknown>;
}

export interface AgentLoopResult {
  status: "resolved" | "escalated";
  resolution: Record<string, unknown> | null;
}

/** Read-only tools: the loop owns their agent_actions row (they never mutate state). */
const INVESTIGATION_TOOLS = [
  "get_customer",
  "get_order",
  "get_product",
  "get_inventory",
  "get_policy",
] as const;

type InvestigationTool = (typeof INVESTIGATION_TOOLS)[number];

function isInvestigationTool(tool: string): tool is InvestigationTool {
  return (INVESTIGATION_TOOLS as readonly string[]).includes(tool);
}

/** State-changing tools plus verification: each writes its own agent_actions row (ARCHITECTURE.md Section 4). */
const SELF_LOGGING_TOOLS = ["create_refund", "create_replacement", "cancel_order", "create_return", "verify_case"] as const;
const STATE_CHANGING_TOOLS = ["create_refund", "create_replacement", "cancel_order", "create_return"] as const;

/** Canonical `resolution.action` value per state-changing tool, so verify_case and the UI agree. */
const ACTION_NAME: Record<string, string> = {
  create_refund: "refund",
  create_replacement: "replacement",
  cancel_order: "cancel",
  create_return: "return",
};

const investigationExecutors: Record<InvestigationTool, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  get_customer: async (args) => getCustomer(args as { customer_id: string }) as unknown as Record<string, unknown>,
  get_order: async (args) => getOrder(args as { order_id: string }) as unknown as Record<string, unknown>,
  get_product: async (args) => getProduct(args as { product_id: string }) as unknown as Record<string, unknown>,
  get_inventory: async (args) => getInventory(args as { product_id: string }) as unknown as Record<string, unknown>,
  get_policy: async (args) => getPolicy(args as { policy_type: string }) as unknown as Record<string, unknown>,
};

async function executeSelfLoggingTool(
  caseId: string,
  step: number,
  tool: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (tool) {
    case "create_refund": {
      const result = await createRefund(caseId, step, args as { order_id: string });
      return { status: result.status, output: result.output as unknown as Record<string, unknown> };
    }
    case "create_replacement": {
      const result = await createReplacement(caseId, step, args as { order_id: string });
      return { status: result.status, output: result.output as unknown as Record<string, unknown> };
    }
    case "cancel_order": {
      const result = await cancelOrder(caseId, step, args as { order_id: string });
      return { status: result.status, output: result.output as unknown as Record<string, unknown> };
    }
    case "create_return": {
      const result = await createReturn(caseId, step, args as { order_id: string });
      return { status: result.status, output: result.output as unknown as Record<string, unknown> };
    }
    case "verify_case": {
      const result = await verifyCase(caseId, step, args as { case_id: string });
      return { status: result.verified ? "success" : "error", output: { verified: result.verified, checks: result.checks } };
    }
    default:
      return { status: "error", output: { error: `Unknown action tool: ${tool}` } };
  }
}

/** Assembles the Gemini context from current DB state. Policy is pre-selected from the message. */
async function buildContext(
  supabase: SupabaseClient,
  caseId: string,
  customerMessage: string,
  previousActions: AgentContext["previousActions"],
  iteration: number,
): Promise<AgentContext> {
  const context: AgentContext = { caseId, customerMessage, previousActions, iteration };

  const caseData = await supabase.from("cases").select("customer_id, order_id").eq("id", caseId).single();
  if (caseData.data?.customer_id) {
    try {
      context.customer = await getCustomer({ customer_id: caseData.data.customer_id });
    } catch {}
  }
  if (caseData.data?.order_id) {
    try {
      context.order = await getOrder({ order_id: caseData.data.order_id });
      if (context.order?.product_id) {
        try {
          context.product = await getProduct({ product_id: context.order.product_id });
        } catch {}
        try {
          context.inventory = await getInventory({ product_id: context.order.product_id });
        } catch {}
      }
    } catch {}
  }

  const msg = customerMessage.toLowerCase();
  const policyType = msg.includes("damaged") || msg.includes("broken") || msg.includes("defective")
    ? "damaged_item"
    : msg.includes("cancel")
      ? "cancellation"
      : msg.includes("refund") || msg.includes("money back")
        ? "refund_approval"
        : null;

  if (policyType) {
    try {
      const policyResult = await getPolicy({ policy_type: policyType });
      context.policy = { ...policyResult, rules: policyResult.rules as Record<string, unknown> };
    } catch {}
  }

  return context;
}

async function markEscalated(
  supabase: SupabaseClient,
  caseId: string,
  resolution: Record<string, unknown>,
): Promise<AgentLoopResult> {
  await supabase.from("cases").update({ status: "escalated", resolution }).eq("id", caseId);
  return { status: "escalated", resolution };
}

/**
 * Verification passed: the case becomes `resolved` only here. The recorded resolution merges the
 * action claim with the verification summary so the resolution page still shows what was done.
 */
async function markResolved(
  supabase: SupabaseClient,
  caseId: string,
  verification: Record<string, unknown>,
): Promise<AgentLoopResult> {
  const { data } = await supabase.from("cases").select("resolution").eq("id", caseId).single();
  const claim = (data?.resolution as Record<string, unknown> | null) ?? {};
  const resolution = { ...claim, ...verification };
  await supabase.from("cases").update({ status: "resolved", resolution }).eq("id", caseId);
  return { status: "resolved", resolution };
}

export async function runAgentLoop(
  supabase: SupabaseClient,
  caseId: string,
  customerMessage: string,
): Promise<AgentLoopResult> {
  let iteration = 0;
  let step = 1;

  await supabase.from("cases").update({ status: "in_progress" }).eq("id", caseId);

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const previousActions = await getAgentActions(supabase, caseId);
    const context = await buildContext(supabase, caseId, customerMessage, previousActions, iteration);

    let toolRequest;
    try {
      toolRequest = await callGemini(context);
    } catch (error) {
      // A spent daily quota is infrastructure, not a case outcome: propagating it stops callers
      // (the scenario sweep especially) from mistaking "Gemini was unavailable" for a real
      // escalation, which would otherwise be recorded as a false verdict on the case.
      if (error instanceof GeminiDailyQuotaExceededError) {
        throw error;
      }
      return markEscalated(supabase, caseId, {
        error: "Gemini failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const { tool, args } = toolRequest;
    console.log(`[Agent] Iteration ${iteration}, Step ${step}: ${tool}(${JSON.stringify(args)})`);

    // Read-only tool: execute, then the loop records the single agent_actions row for it.
    if (isInvestigationTool(tool)) {
      let result: ToolResult;
      try {
        result = { status: "success", output: await investigationExecutors[tool](args) };
      } catch (error) {
        result = { status: "error", output: { error: error instanceof Error ? error.message : "Unknown error" } };
      }
      await supabase.from("agent_actions").insert({
        case_id: caseId,
        step,
        tool,
        input: args,
        output: result.output,
        status: result.status,
      });
      step++;
      continue;
    }

    // Self-logging tool: the tool itself writes the agent_actions row, so the loop must not.
    if ((SELF_LOGGING_TOOLS as readonly string[]).includes(tool)) {
      const result = await executeSelfLoggingTool(caseId, step, tool, args);
      step++;

      if (tool === "verify_case") {
        return result.output.verified === true
          ? markResolved(supabase, caseId, result.output)
          : markEscalated(supabase, caseId, { error: "Verification failed", checks: result.output.checks });
      }

      if (result.status === "success" && (STATE_CHANGING_TOOLS as readonly string[]).includes(tool)) {
        // Record the claim now; verify_case checks it against real DB state before resolving.
        await supabase
          .from("cases")
          .update({ resolution: { action: ACTION_NAME[tool], ...result.output } })
          .eq("id", caseId);
      }
      continue;
    }

    // Unknown tool: record the error so the trail shows what the model asked for, then continue.
    await supabase.from("agent_actions").insert({
      case_id: caseId,
      step,
      tool,
      input: args,
      output: { error: `Unknown tool: ${tool}` },
      status: "error",
    });
    step++;
  }

  return markEscalated(supabase, caseId, { error: "Max iterations exceeded" });
}
