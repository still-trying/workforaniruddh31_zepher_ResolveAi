import { describe, it, expect } from 'vitest';
import { getCustomer } from '@/lib/tools/get-customer';

describe('get_customer', () => {
  it('returns correct data for a known customer id', async () => {
    const result = await getCustomer({ customer_id: 'CUST001' });

    expect(result).toMatchObject({
      id: 'CUST001',
      name: 'Ananya Rao',
      email: 'ananya.rao@example.com',
      customer_tier: 'standard',
    });
  });

  it('returns correct data for premium customer', async () => {
    const result = await getCustomer({ customer_id: 'CUST002' });

    expect(result).toMatchObject({
      id: 'CUST002',
      customer_tier: 'premium',
    });
  });

  it('throws error for non-existent customer', async () => {
    await expect(getCustomer({ customer_id: 'NONEXISTENT' })).rejects.toThrow(
      /not found/
    );
  });
});
