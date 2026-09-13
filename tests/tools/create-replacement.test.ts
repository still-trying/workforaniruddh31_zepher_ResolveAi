import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { createReplacement } from '@/lib/tools/create-replacement';
import { getInventory } from '@/lib/tools/get-inventory';
import { getNextStep } from '@/tests/utils/step-counter';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('create_replacement', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeEach(async () => {
    supabase = createServerSupabaseClient();
    // Pin ORD002 delivered inside the claim window so this suite does not depend on seed age.
    await supabase.from('orders').update({ status: 'delivered', delivery_date: daysAgo(1) }).eq('id', 'ORD002');
  });

  afterEach(async () => {
    // Clean up test replacement orders
    await supabase.from('orders').delete().like('id', 'ORD-NEW-%');
    // Restore ORD002 (this suite cancels it) so the seeded demo data stays usable
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', 'ORD002');
    // Restore inventory for PROD002
    await supabase.from('inventory').update({ available_quantity: 12 }).eq('product_id', 'PROD002');
    // Clean up agent_actions for test case
    await supabase.from('agent_actions').delete().eq('case_id', 'CASE001');
  });

  it('creates replacement successfully when inventory available', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // First check inventory for PROD002 (espresso machine, 12 in stock)
    const inventory = await getInventory({ product_id: 'PROD002' });
    expect(inventory.available_quantity).toBeGreaterThan(0);

    // ORD002 is delivered espresso machine by premium customer
    const result = await createReplacement(testCaseId, step, { order_id: 'ORD002' });

    expect(result.status).toBe('success');
    expect(result.output).toMatchObject({
      order_id: 'ORD002',
      replacement_status: 'created',
    });
    expect(result.output.new_order_id).toMatch(/^ORD-NEW-/);

    // Verify inventory was decremented
    const newInventory = await getInventory({ product_id: 'PROD002' });
    expect(newInventory.available_quantity).toBe(inventory.available_quantity - 1);

    // Verify action was logged
    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('create_replacement');
    expect(action?.status).toBe('success');
  });

  it('returns blocked when inventory is zero (flagship replan scenario)', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // PROD001 (headphones) has 0 inventory - flagship scenario
    const result = await createReplacement(testCaseId, step, { order_id: 'ORD001' });

    expect(result.status).toBe('blocked');
    expect(result.output.replacement_status).toBe('blocked');
    expect(result.output.new_order_id).toBe('');
  });

  it('returns blocked for non-delivered order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // ORD006 is placed, not delivered
    const result = await createReplacement(testCaseId, step, { order_id: 'ORD006' });

    expect(result.status).toBe('blocked');
  });

  it('returns blocked for shipped order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    // ORD003 is shipped
    const result = await createReplacement(testCaseId, step, { order_id: 'ORD003' });

    expect(result.status).toBe('blocked');
  });

  it('returns blocked for non-existent order', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    const result = await createReplacement(testCaseId, step, { order_id: 'NONEXISTENT' });

    expect(result.status).toBe('blocked');
  });

  it('logs action with blocked status when inventory unavailable', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    await createReplacement(testCaseId, step, { order_id: 'ORD001' });

    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status, output')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('create_replacement');
    expect(action?.status).toBe('blocked');
  });
});