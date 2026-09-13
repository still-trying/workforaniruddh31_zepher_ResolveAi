import { describe, it, expect } from 'vitest';
import { getProduct } from '@/lib/tools/get-product';

describe('get_product', () => {
  it('returns correct data for a known product id', async () => {
    const result = await getProduct({ product_id: 'PROD001' });

    expect(result).toMatchObject({
      id: 'PROD001',
      name: 'Wireless Headphones',
      category: 'Audio',
      price: 129.99,
    });
  });

  it('returns correct data for another product', async () => {
    const result = await getProduct({ product_id: 'PROD003' });

    expect(result).toMatchObject({
      id: 'PROD003',
      name: 'Running Shoes',
      category: 'Footwear',
      price: 89.5,
    });
  });

  it('throws error for non-existent product', async () => {
    await expect(getProduct({ product_id: 'NONEXISTENT' })).rejects.toThrow(
      /not found/
    );
  });
});
