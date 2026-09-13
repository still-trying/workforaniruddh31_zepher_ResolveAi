import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logAction } from './log-action';
import { evaluateClaimWindow } from './claim-window';
import type { CreateReplacementInput, CreateReplacementOutput, PolicyRules } from '@/types';

interface ReplacementResult {
  status: 'success' | 'blocked';
  output: CreateReplacementOutput;
}

/** Records a blocked outcome so the agent_actions trail shows the refused attempt (ARCHITECTURE.md Section 4). */
async function blocked(
  caseId: string,
  step: number,
  input: CreateReplacementInput,
): Promise<ReplacementResult> {
  const output = {
    order_id: input.order_id,
    replacement_status: 'blocked',
    new_order_id: '',
  } as unknown as CreateReplacementOutput;

  await logAction({
    case_id: caseId,
    step,
    tool: 'create_replacement',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'blocked',
  });

  return { status: 'blocked', output };
}

export async function createReplacement(
  caseId: string,
  step: number,
  input: CreateReplacementInput
): Promise<ReplacementResult> {
  const supabase = createServerSupabaseClient();

  // Re-validate preconditions server-side
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status, product_id, customer_id, price, order_date, delivery_date')
    .eq('id', input.order_id)
    .single();

  if (orderError || !order) {
    return blocked(caseId, step, input);
  }

  // Order must be delivered for replacement
  if (order.status !== 'delivered') {
    return blocked(caseId, step, input);
  }

  // Check inventory - must have available quantity
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('available_quantity')
    .eq('product_id', order.product_id)
    .single();

  if (invError || !inventory || inventory.available_quantity <= 0) {
    return blocked(caseId, step, input);
  }

  // Check damaged_item policy allows replacement
  const { data: policy } = await supabase
    .from('policies')
    .select('rules')
    .eq('policy_type', 'damaged_item')
    .single();

  const rules = (policy?.rules as PolicyRules) || {};
  if (rules.replacement_allowed !== true) {
    return blocked(caseId, step, input);
  }

  // Enforce the damaged-item claim window before creating a replacement
  const claimWindow = evaluateClaimWindow(
    { order_date: order.order_date, delivery_date: order.delivery_date },
    rules,
  );
  if (!claimWindow.withinWindow) {
    return blocked(caseId, step, input);
  }

  // Generate new order ID
  const newOrderId = `ORD-NEW-${Date.now()}`;

  // Create the replacement order
  const { error: insertError } = await supabase.from('orders').insert({
    id: newOrderId,
    customer_id: order.customer_id,
    product_id: order.product_id,
    status: 'placed',
    order_date: new Date().toISOString().split('T')[0],
    price: order.price,
  });

  if (insertError) {
    return blocked(caseId, step, input);
  }

  // Decrement inventory
  await supabase
    .from('inventory')
    .update({ available_quantity: inventory.available_quantity - 1 })
    .eq('product_id', order.product_id);

  // Cancel the original order
  await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', input.order_id);

  const output = {
    order_id: input.order_id,
    replacement_status: 'created',
    new_order_id: newOrderId,
  } as CreateReplacementOutput;

  // Log the action
  await logAction({
    case_id: caseId,
    step,
    tool: 'create_replacement',
    input: { order_id: input.order_id },
    output: output as unknown as Record<string, unknown>,
    status: 'success',
  });

  return { status: 'success', output };
}
