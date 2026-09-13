import type { SupabaseClient } from "@supabase/supabase-js";

// Read the key lazily and from either runtime, so this module can be imported by the Next
// server, by CLI scripts, and by the Deno Edge Function without an import-time crash.
function readGeminiApiKey(): string {
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const denoEnv = (globalThis as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno?.env;
  const key = nodeEnv?.GEMINI_API_KEY ?? denoEnv?.get?.("GEMINI_API_KEY");
  if (!key) {
    throw new Error("GEMINI_API_KEY must be set server-side");
  }
  return key;
}

// Use v1beta API with gemini-3.6-flash model
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export const MAX_ITERATIONS = 12;

export interface ToolRequest {
  tool: string;
  args: Record<string, unknown>;
}

export interface AgentContext {
  caseId: string;
  customerMessage: string;
  customer?: { id: string; name: string; email: string; customer_tier: string };
  order?: { id: string; customer_id: string; product_id: string; status: string; order_date: string; delivery_date: string | null; price: number };
  product?: { id: string; name: string; category: string; price: number };
  inventory?: { product_id: string; available_quantity: number; warehouse: string };
  policy?: { id: string; policy_type: string; rules: Record<string, unknown> };
  previousActions: Array<{ step: number; tool: string; input: Record<string, unknown>; output: Record<string, unknown>; status: string }>;
  iteration: number;
}

function buildSystemPrompt(): string {
  return `You are ResolveAI, an autonomous customer-resolution agent. Your job is to resolve customer issues by investigating data, deciding on a resolution, executing actions, verifying results, and replanning if blocked.

You operate in a loop: INVESTIGATE → REASON → ACT → VERIFY → REPLAN if necessary.

Available tools (you must call these by name with exact argument shapes):

INVESTIGATION TOOLS (read-only):
- get_customer(customer_id: string) → { id, name, email, customer_tier }
- get_order(order_id: string) → { id, customer_id, product_id, status, order_date, delivery_date, price }
- get_product(product_id: string) → { id, name, category, price }
- get_inventory(product_id: string) → { product_id, available_quantity, warehouse }
- get_policy(policy_type: string) → { id, policy_type, rules }

ACTION TOOLS (state-changing):
- create_refund(order_id: string) → { order_id, refund_status: 'processed', amount }
- create_replacement(order_id: string) → { order_id, replacement_status: 'created', new_order_id }
- cancel_order(order_id: string) → { order_id, status: 'cancelled' }
- create_return(order_id: string) → { order_id, return_status: 'created' }   (the permitted alternative when an order has shipped and cannot be cancelled, but the cancellation policy permits a return)

VERIFICATION TOOL:
- verify_case(case_id: string) → { case_id, verified: boolean, checks: [...] }

Rules:
1. ALWAYS investigate first — never assume data. Use tools to retrieve customer, order, product, inventory, and policy.
2. Decide the resolution the CUSTOMER ASKED FOR, based on the retrieved evidence and policy constraints. If they asked for a replacement, that is the plan; if they asked for a refund, that is the plan; if they asked to cancel, that is the plan.
3. Attempt the customer's requested resolution FIRST, even if you suspect stock or policy may block it. Do not pre-emptively switch to a different action — call the requested tool and let it answer.
4. A 'blocked' result is a normal, expected outcome: it is the signal to replan. After a blocked action, investigate a valid alternative using the available tools, then act on it.
5. Execute EXACTLY ONE action per decision. Wait for the result before deciding the next step.
6. After an action succeeds, you MUST call verify_case to confirm the state change.
7. The case ends only when verify_case returns verified=true (resolved) or no valid alternatives remain (escalated).
8. Output format: You must respond with a JSON object containing "tool" and "args" fields. Nothing else.`;
}

function buildUserPrompt(context: AgentContext): string {
  const { caseId, customerMessage, customer, order, product, inventory, policy, previousActions, iteration } = context;

  let prompt = `CASE ${caseId} (Iteration ${iteration})\n`;
  prompt += `Customer message: "${customerMessage}"\n\n`;

  if (customer) {
    prompt += `Customer: ${JSON.stringify(customer, null, 2)}\n\n`;
  }
  if (order) {
    prompt += `Order: ${JSON.stringify(order, null, 2)}\n\n`;
  }
  if (product) {
    prompt += `Product: ${JSON.stringify(product, null, 2)}\n\n`;
  }
  if (inventory) {
    prompt += `Inventory: ${JSON.stringify(inventory, null, 2)}\n\n`;
  }
  if (policy) {
    prompt += `Policy: ${JSON.stringify(policy, null, 2)}\n\n`;
  }

  if (previousActions.length > 0) {
    prompt += `Previous actions:\n`;
    for (const action of previousActions) {
      prompt += `  Step ${action.step}: ${action.tool}(${JSON.stringify(action.input)}) → ${action.status}: ${JSON.stringify(action.output)}\n`;
    }
    prompt += "\n";
  }

  prompt += "Decide the next tool to call. Respond ONLY with JSON: { \"tool\": \"tool_name\", \"args\": { ... } }";

  return prompt;
}

const MAX_GEMINI_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Thrown when the API key's *daily* request allowance is spent. A per-minute rate limit recovers
 * by waiting; a daily one cannot, so it is never retried and is propagated rather than swallowed
 * into a case verdict — a quota outage is an infrastructure failure, not a resolution outcome.
 */
export class GeminiDailyQuotaExceededError extends Error {
  constructor(detail: string) {
    super(`Gemini daily quota exhausted (${detail}). Requests cannot succeed again until the quota resets.`);
    this.name = "GeminiDailyQuotaExceededError";
  }
}

/**
 * A 429 body names the quota that was violated. A per-day violation means waiting cannot help,
 * whereas a per-minute one is transient and worth retrying.
 */
async function dailyQuotaDetail(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().text();
    if (!/quota/i.test(body) || !/per[\s-]*day/i.test(body)) {
      return null;
    }
    const quotaId = body.match(/"quotaId"\s*:\s*"([^"]+)"/)?.[1] ?? "daily request quota";
    const limit = body.match(/"quotaValue"\s*:\s*"([^"]+)"/)?.[1];
    return limit ? `${quotaId}, limit ${limit}` : quotaId;
  } catch {
    return null;
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retriesLeft: number = MAX_GEMINI_RETRIES): Promise<Response> {
  const response = await fetch(url, options);

  // Fail fast when the daily allowance is gone: retrying cannot recover it, so don't burn the
  // backoff budget (the scenario sweep used to spend ~8 minutes retrying an exhausted quota).
  if (response.status === 429) {
    const dailyQuota = await dailyQuotaDetail(response);
    if (dailyQuota) {
      throw new GeminiDailyQuotaExceededError(dailyQuota);
    }
  }
  
  // Retry transient failures: per-minute rate limits (429) and server-side 5xx errors, which are
  // often momentary (e.g. "model experiencing high demand") and would otherwise kill a case run.
  const isTransient = response.status === 429 || response.status >= 500;
  if (isTransient && retriesLeft > 0) {
    const retryAfterHeader = response.headers.get("Retry-After");
    let delayMs: number;
    
    if (retryAfterHeader) {
      delayMs = parseInt(retryAfterHeader, 10) * 1000;
    } else {
      const attempt = MAX_GEMINI_RETRIES - retriesLeft;
      delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
    }
    
    const reason = response.status === 429 ? "Rate limited" : "Transient server error";
    console.log(`[Gemini] ${reason} (${response.status}). Retrying in ${Math.round(delayMs)}ms (${retriesLeft} retries left)...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return fetchWithRetry(url, options, retriesLeft - 1);
  }
  
  return response;
}

export async function callGemini(context: AgentContext): Promise<ToolRequest> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context);

  const response = await fetchWithRetry(`${GEMINI_API_URL}?key=${readGeminiApiKey()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I will respond only with valid JSON tool requests." }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  // Strip markdown code fences if present
  let cleanText = text;
  if (text.startsWith("```")) {
    // Find the first ``` and last ```
    const firstFence = text.indexOf("```");
    const lastFence = text.lastIndexOf("```");
    if (firstFence !== -1 && lastFence !== -1 && firstFence !== lastFence) {
      cleanText = text.slice(firstFence + 3, lastFence).trim();
      // Remove language specifier if present (e.g., "json")
      const firstNewline = cleanText.indexOf("\n");
      if (firstNewline !== -1 && cleanText.slice(0, firstNewline).trim().length < 20) {
        cleanText = cleanText.slice(firstNewline + 1);
      }
    }
  }

  try {
    const parsed = JSON.parse(cleanText);
    if (!parsed.tool || !parsed.args) {
      throw new Error("Invalid tool request: missing tool or args");
    }
    return { tool: parsed.tool, args: parsed.args };
  } catch {
    throw new Error(`Failed to parse Gemini response as tool request: ${text}`);
  }
}

export async function getCaseContext(
  supabase: SupabaseClient,
  caseId: string
): Promise<{
  customerMessage: string;
  customerId: string;
  orderId: string;
}> {
  const { data: caseData, error } = await supabase
    .from("cases")
    .select("customer_message, customer_id, order_id")
    .eq("id", caseId)
    .single();

  if (error || !caseData) {
    throw new Error(`Case ${caseId} not found: ${error?.message}`);
  }

  return {
    customerMessage: caseData.customer_message,
    customerId: caseData.customer_id,
    orderId: caseData.order_id,
  };
}

export async function getAgentActions(
  supabase: SupabaseClient,
  caseId: string
): Promise<Array<{ step: number; tool: string; input: Record<string, unknown>; output: Record<string, unknown>; status: string }>> {
  const { data, error } = await supabase
    .from("agent_actions")
    .select("step, tool, input, output, status")
    .eq("case_id", caseId)
    .order("step", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch agent_actions: ${error.message}`);
  }

  return data || [];
}