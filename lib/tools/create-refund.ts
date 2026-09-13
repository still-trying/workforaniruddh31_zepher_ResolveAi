import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logAction } from './log-action';
import { evaluateClaimWindow } from './claim-window';
import type { CreateRefundInput, CreateRefundOutput, PolicyRules } from '@/types';

interface RefundResult {
  status: 'success' | 'blocked';
  output: CreateRefundOutput;
}

/** Records a blocked outcome so the agent_actions trail shows the refused attempt (ARCHITECTURE.md Section 4). */
async function blocked(
  caseId: string,
  step: number,
  input: CreateRefundInput,
  amount: number,
): Promise<RefundResult> {
  const output = {
    order_id: input.order_id,
    refund_status: 'blocked',
    amount,
  } as unknown as CreateRefundOutput;

  await logAction({
    case_id: caseId,
    step,
    tool: 'create_refund',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'blocked',
  });

  return { status: 'blocked', output };
}

export async function createRefund(
  caseId: string,
  step: number,
  input: CreateRefundInput
): Promise<RefundResult> {
  const supabase = createServerSupabaseClient();

  // Re-validate preconditions server-side (never trust Gemini's claim)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, price, product_id, customer_id, order_date, delivery_date')
    .eq('id', input.order_id)
    .single();

  if (orderError || !order) {
    return blocked(caseId, step, input, 0);
  }

  // Check order status - can only refund delivered or placed orders
  if (!['delivered', 'placed'].includes(order.status)) {
    return blocked(caseId, step, input, 0);
  }

  // Enforce the damaged-item claim window before granting a refund
  const { data: damagedPolicy } = await supabase
    .from('policies')
    .select('rules')
    .eq('policy_type', 'damaged_item')
    .single();

  const claimWindow = evaluateClaimWindow(
    { order_date: order.order_date, delivery_date: order.delivery_date },
    (damagedPolicy?.rules as PolicyRules) || {},
  );
  if (!claimWindow.withinWindow) {
    return blocked(caseId, step, input, order.price);
  }

  // Get customer tier for policy check
  const { data: customer } = await supabase
    .from('customers')
    .select('customer_tier')
    .eq('id', order.customer_id)
    .single();

  // Get refund policy
  const { data: policy } = await supabase
    .from('policies')
    .select('rules')
    .eq('policy_type', 'refund_approval')
    .single();

  const rules = (policy?.rules as Record<string, unknown>) || {};
  const refundRequiresApproval = rules.refund_requires_approval as boolean ?? false;
  const approvalThreshold = rules.approval_threshold as number ?? Infinity;
  const autoRefundTiers = (rules.auto_refund_tiers as string[]) || [];

  // Check if refund needs approval
  if (refundRequiresApproval && order.price > approvalThreshold) {
    // Premium tier gets auto-approved
    if (!autoRefundTiers.includes(customer?.customer_tier ?? '')) {
      return blocked(caseId, step, input, order.price);
    }
  }

  // Execute the refund
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', input.order_id);

  if (updateError) {
    return blocked(caseId, step, input, order.price);
  }

  const output = {
    order_id: input.order_id,
    refund_status: 'processed',
    amount: order.price,
  } as CreateRefundOutput;

  // Log the action
  await logAction({
    case_id: caseId,
    step,
    tool: 'create_refund',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'success',
  });

  return { status: 'success', output };
}
