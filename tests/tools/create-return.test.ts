import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { createReturn } from '@/lib/tools/create-return';
import { getNextStep } from '@/tests/utils/step-counter';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('create_return', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeEach(async () => {
    supabase = createServerSupabaseClient();
  });

  afterEach(async () => {
    // Restore ORD003 to its seeded shipped state
    await supabase
      .from('orders')
      .update({ status: 'shipped', delivery_date: null, order_date: daysAgo(2) })
      .eq('id', 'ORD003');
    await supabase.from('agent_actions').delete().eq('case_id', 'CASE003');
  });

  it('creates a return for a shipped order inside the return window', async () => {
    const step = getNextStep();
    await supabase
      .from('orders')
      .update({ status: 'shipped', delivery_date: null, order_date: daysAgo(2) })
      .eq('id', 'ORD003');

    const result = await createReturn('CASE003', step, { order_id: 'ORD003' });

    expect(result.status).toBe('success');
    expect(result.output).toMatchObject({ order_id: 'ORD003', return_status: 'created' });

    // The order is no longer active
    const { data: order } = await supabase.from('orders').select('status').eq('id', 'ORD003').single();
    expect(order?.status).toBe('cancelled');

    // The action was logged
    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', 'CASE003')
      .eq('step', step)
      .single();
    expect(action?.tool).toBe('create_return');
    expect(action?.status).toBe('success');
  });

  it('returns blocked when the order has not shipped', async () => {
    const step = getNextStep();
    // ORD002 is delivered, not shipped
    const result = await createReturn('CASE003', step, { order_id: 'ORD002' });

    expect(result.status).toBe('blocked');
    expect(result.output.return_status).toBe('blocked');
  });

  it('returns blocked when the return window has expired', async () => {
    const step = getNextStep();
    await supabase
      .from('orders')
      .update({ status: 'shipped', delivery_date: null, order_date: daysAgo(30) })
      .eq('id', 'ORD003');

    const result = await createReturn('CASE003', step, { order_id: 'ORD003' });

    expect(result.status).toBe('blocked');
  });

  it('returns blocked for a non-existent order', async () => {
    const step = getNextStep();
    const result = await createReturn('CASE003', step, { order_id: 'NONEXISTENT' });

    expect(result.status).toBe('blocked');
  });

  it('logs a blocked action when the order has not shipped', async () => {
    const step = getNextStep();
    await createReturn('CASE003', step, { order_id: 'ORD002' });

    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', 'CASE003')
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('create_return');
    expect(action?.status).toBe('blocked');
  });
});
