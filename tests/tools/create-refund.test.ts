import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { createRefund } from '@/lib/tools/create-refund';
import { getNextStep } from '@/tests/utils/step-counter';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('create_refund', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeEach(async () => {
    supabase = createServerSupabaseClient();
  });

  afterEach(async () => {
    // Restore the orders this suite mutates
    await supabase.from('orders').update({ status: 'delivered' }).in('id', ['ORD001', 'ORD005']);
    // Clean up agent_actions for test case
    await supabase.from('agent_actions').delete().eq('case_id', 'CASE001');
  });

  it('processes refund successfully for a delivered order inside the claim window', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // Pin ORD001 inside the claim window so this test does not depend on when the DB was seeded.
    await supabase.from('orders').update({ status: 'delivered', delivery_date: daysAgo(1) }).eq('id', 'ORD001');

    const result = await createRefund(testCaseId, step, { order_id: 'ORD001' });

    expect(result.status).toBe('success');
    expect(result.output).toMatchObject({
      order_id: 'ORD001',
      refund_status: 'processed',
      amount: 129.99,
    });

    // Verify order was cancelled
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', 'ORD001')
      .single();

    expect(order?.status).toBe('cancelled');

    // Verify action was logged
    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('create_refund');
    expect(action?.status).toBe('success');
  });

  it('returns blocked when the damaged-item claim window has expired', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // ORD005 is the aged order from Scenario 5; pin it outside the 7-day window deterministically.
    await supabase.from('orders').update({ status: 'delivered', delivery_date: daysAgo(30) }).eq('id', 'ORD005');

    const result = await createRefund(testCaseId, step, { order_id: 'ORD005' });

    expect(result.status).toBe('blocked');
    expect(result.output.refund_status).toBe('blocked');
  });

  it('returns blocked for non-existent order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    const result = await createRefund(testCaseId, step, { order_id: 'NONEXISTENT' });

    expect(result.status).toBe('blocked');
    expect(result.output.refund_status).toBe('blocked');
  });

  it('returns blocked for already shipped order (cannot refund)', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // ORD003 is shipped - cannot be refunded
    const result = await createRefund(testCaseId, step, { order_id: 'ORD003' });

    expect(result.status).toBe('blocked');
  });

  it('logs action with correct status on blocked', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    await createRefund(testCaseId, step, { order_id: 'ORD003' });

    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status, output')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('create_refund');
    expect(action?.status).toBe('blocked');
  });
});
