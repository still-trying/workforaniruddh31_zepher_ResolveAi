import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logAction } from './log-action';
import { evaluateReturnWindow } from './claim-window';
import type { CreateReturnInput, CreateReturnOutput, PolicyRules } from '@/types';

interface ReturnResult {
  status: 'success' | 'blocked';
  output: CreateReturnOutput;
}

/** Records a blocked outcome so the agent_actions trail shows the refused attempt (ARCHITECTURE.md Section 4). */
async function blocked(
  caseId: string,
  step: number,
  input: CreateReturnInput,
): Promise<ReturnResult> {
  const output = {
    order_id: input.order_id,
    return_status: 'blocked',
  } as unknown as CreateReturnOutput;

  await logAction({
    case_id: caseId,
    step,
    tool: 'create_return',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'blocked',
  });

  return { status: 'blocked', output };
}

export async function createReturn(
  caseId: string,
  step: number,
  input: CreateReturnInput
): Promise<ReturnResult> {
  const supabase = createServerSupabaseClient();

  // Re-validate preconditions server-side (never trust Gemini's claim)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, order_date, delivery_date')
    .eq('id', input.order_id)
    .single();

  if (orderError || !order) {
    return blocked(caseId, step, input);
  }

  // A return is the permitted alternative once an order has shipped but can no longer be cancelled
  if (order.status !== 'shipped') {
    return blocked(caseId, step, input);
  }

  // The cancellation policy governs whether a return is permitted after shipping
  const { data: policy } = await supabase
    .from('policies')
    .select('rules')
    .eq('policy_type', 'cancellation')
    .single();

  const rules = (policy?.rules as PolicyRules) || {};
  if (rules.return_allowed_after_shipping !== true) {
    return blocked(caseId, step, input);
  }

  // Enforce the return window (measured from order_date for a not-yet-delivered order)
  const returnWindow = evaluateReturnWindow(
    { order_date: order.order_date, delivery_date: order.delivery_date },
    rules,
  );
  if (!returnWindow.withinWindow) {
    return blocked(caseId, step, input);
  }

  // Execute the return: the order is no longer active. orders.status stays inside the documented
  // enum ('placed' | 'shipped' | 'delivered' | 'cancelled'); the distinction lives in the resolution.
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', input.order_id);

  if (updateError) {
    return blocked(caseId, step, input);
  }

  const output = {
    order_id: input.order_id,
    return_status: 'created',
  } as CreateReturnOutput;

  await logAction({
    case_id: caseId,
    step,
    tool: 'create_return',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'success',
  });

  return { status: 'success', output };
}
