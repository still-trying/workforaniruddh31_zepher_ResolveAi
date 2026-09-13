import { describe, it, expect } from 'vitest';
import { getInventory } from '@/lib/tools/get-inventory';

describe('get_inventory', () => {
  it('returns correct quantity for a product with stock', async () => {
    const result = await getInventory({ product_id: 'PROD002' });

    expect(result).toMatchObject({
      product_id: 'PROD002',
      available_quantity: 12,
      warehouse: 'WH-A',
    });
  });

  it('returns zero quantity for out-of-stock product (flagship scenario)', async () => {
    const result = await getInventory({ product_id: 'PROD001' });

    expect(result).toMatchObject({
      product_id: 'PROD001',
      available_quantity: 0,
      warehouse: 'WH-A',
    });
  });

  it('returns correct quantity for another product', async () => {
    const result = await getInventory({ product_id: 'PROD005' });

    expect(result).toMatchObject({
      product_id: 'PROD005',
      available_quantity: 25,
    });
  });

  it('throws error for non-existent product', async () => {
    await expect(getInventory({ product_id: 'NONEXISTENT' })).rejects.toThrow(
      /no inventory found/
    );
  });
});
