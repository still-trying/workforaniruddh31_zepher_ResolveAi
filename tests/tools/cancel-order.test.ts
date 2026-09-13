import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { cancelOrder } from '@/lib/tools/cancel-order';
import { getNextStep } from '@/tests/utils/step-counter';

describe('cancel_order', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeEach(async () => {
    supabase = createServerSupabaseClient();
    // Ensure ORD006 is in placed status
    await supabase.from('orders').update({ status: 'placed' }).eq('id', 'ORD006');
  });

  afterEach(async () => {
    // Restore ORD006 to placed status if it was cancelled
    await supabase.from('orders').update({ status: 'placed' }).eq('id', 'ORD006');
    // Clean up agent_actions for test case
    await supabase.from('agent_actions').delete().eq('case_id', 'CASE003');
  });

  it('cancels placed order successfully', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE003';
    // ORD006 is a placed order
    const result = await cancelOrder(testCaseId, step, { order_id: 'ORD006' });

    expect(result.status).toBe('success');
    expect(result.output).toMatchObject({
      order_id: 'ORD006',
      status: 'cancelled',
    });

    // Verify order was cancelled
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', 'ORD006')
      .single();

    expect(order?.status).toBe('cancelled');

    // Verify action was logged
    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('cancel_order');
    expect(action?.status).toBe('success');
  });

  it('returns blocked for shipped order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE003';
    // ORD003 is shipped - cancellation policy disallows after shipping
    const result = await cancelOrder(testCaseId, step, { order_id: 'ORD003' });

    expect(result.status).toBe('blocked');
    expect(result.output.status).toBe('blocked');
  });

  it('returns blocked for delivered order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE003';
    // ORD001 is delivered
    const result = await cancelOrder(testCaseId, step, { order_id: 'ORD001' });

    expect(result.status).toBe('blocked');
  });

  it('returns blocked for already cancelled order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE003';
    // First cancel ORD006
    await cancelOrder(testCaseId, step, { order_id: 'ORD006' });

    // Try to cancel again
    const result = await cancelOrder(testCaseId, getNextStep(), { order_id: 'ORD006' });

    expect(result.status).toBe('blocked');
  });

  it('returns blocked for non-existent order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE003';
    const result = await cancelOrder(testCaseId, step, { order_id: 'NONEXISTENT' });

    expect(result.status).toBe('blocked');
  });

  it('logs action with blocked status when order already shipped', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE003';
    await cancelOrder(testCaseId, step, { order_id: 'ORD003' });

    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('cancel_order');
    expect(action?.status).toBe('blocked');
  });
});