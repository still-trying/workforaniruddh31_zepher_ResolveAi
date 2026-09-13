import { describe, it, expect } from 'vitest';
import { getPolicy } from '@/lib/tools/get-policy';

describe('get_policy', () => {
  it('returns damaged_item policy with replacement and refund allowed', async () => {
    const result = await getPolicy({ policy_type: 'damaged_item' });

    expect(result).toMatchObject({
      id: 'POL001',
      policy_type: 'damaged_item',
    });
    expect(result.rules).toMatchObject({
      replacement_allowed: true,
      refund_allowed: true,
      claim_window_days: 7,
    });
  });

  it('returns cancellation policy with shipping restrictions', async () => {
    const result = await getPolicy({ policy_type: 'cancellation' });

    expect(result).toMatchObject({
      id: 'POL002',
      policy_type: 'cancellation',
    });
    expect(result.rules).toMatchObject({
      cancellation_allowed: true,
      cancellation_allowed_after_shipping: false,
      return_allowed_after_shipping: true,
      return_window_days: 14,
    });
  });

  it('returns refund_approval policy with thresholds', async () => {
    const result = await getPolicy({ policy_type: 'refund_approval' });

    expect(result).toMatchObject({
      id: 'POL003',
      policy_type: 'refund_approval',
    });
    expect(result.rules).toMatchObject({
      refund_requires_approval: true,
      approval_threshold: 200,
      auto_refund_tiers: ['premium'],
    });
  });

  it('throws error for non-existent policy type', async () => {
    await expect(getPolicy({ policy_type: 'nonexistent' })).rejects.toThrow(
      /not found/
    );
  });
});
