import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logAction } from './log-action';
import type { CancelOrderInput, CancelOrderOutput } from '@/types';

interface CancelResult {
  status: 'success' | 'blocked';
  output: CancelOrderOutput;
}

/** Records a blocked outcome so the agent_actions trail shows the refused attempt (ARCHITECTURE.md Section 4). */
async function blocked(
  caseId: string,
  step: number,
  input: CancelOrderInput,
): Promise<CancelResult> {
  const output = {
    order_id: input.order_id,
    status: 'blocked',
  } as unknown as CancelOrderOutput;

  await logAction({
    case_id: caseId,
    step,
    tool: 'cancel_order',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'blocked',
  });

  return { status: 'blocked', output };
}

export async function cancelOrder(
  caseId: string,
  step: number,
  input: CancelOrderInput
): Promise<CancelResult> {
  const supabase = createServerSupabaseClient();

  // Re-validate preconditions server-side
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', input.order_id)
    .single();

  if (orderError || !order) {
    return blocked(caseId, step, input);
  }

  // Can only cancel orders that are 'placed' (not shipped or delivered)
  if (order.status !== 'placed') {
    return blocked(caseId, step, input);
  }

  // Check cancellation policy
  const { data: policy } = await supabase
    .from('policies')
    .select('rules')
    .eq('policy_type', 'cancellation')
    .single();

  const rules = (policy?.rules as Record<string, unknown>) || {};
  if (rules.cancellation_allowed !== true) {
    return blocked(caseId, step, input);
  }

  // Execute cancellation
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', input.order_id);

  if (updateError) {
    return blocked(caseId, step, input);
  }

  const output = {
    order_id: input.order_id,
    status: 'cancelled',
  } as CancelOrderOutput;

  // Log the action
  await logAction({
    case_id: caseId,
    step,
    tool: 'cancel_order',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'success',
  });

  return { status: 'success', output };
}
