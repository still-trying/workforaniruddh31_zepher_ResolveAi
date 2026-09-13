import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { getOrder } from '@/lib/tools/get-order';

describe('get_order', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeEach(async () => {
    supabase = createServerSupabaseClient();
    // Reset the orders this suite reads back to their seeded statuses, so a scenario run that
    // mutated them can't break these assertions.
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', 'ORD001');
    await supabase.from('orders').update({ status: 'placed' }).eq('id', 'ORD006');
  });

  afterEach(async () => {
    // Restore ORD006 to placed status
    await supabase.from('orders').update({ status: 'placed' }).eq('id', 'ORD006');
  });

  it('returns correct data for a known order id', async () => {
    const result = await getOrder({ order_id: 'ORD001' });

    expect(result).toMatchObject({
      id: 'ORD001',
      customer_id: 'CUST001',
      product_id: 'PROD001',
      status: 'delivered',
      price: 129.99,
    });
    expect(result.order_date).toBeDefined();
    expect(result.delivery_date).toBeDefined();
  });

  it('returns correct data for shipped order', async () => {
    const result = await getOrder({ order_id: 'ORD003' });

    expect(result).toMatchObject({
      id: 'ORD003',
      status: 'shipped',
      delivery_date: null,
    });
  });

  it('returns correct data for placed order', async () => {
    const result = await getOrder({ order_id: 'ORD006' });

    expect(result).toMatchObject({
      id: 'ORD006',
      status: 'placed',
      delivery_date: null,
    });
  });

  it('throws error for non-existent order', async () => {
    await expect(getOrder({ order_id: 'NONEXISTENT' })).rejects.toThrow(
      /not found/
    );
  });
});