import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/client';
import { verifyCase } from '@/lib/tools/verify-case';
import { getNextStep } from '@/tests/utils/step-counter';

describe('verify_case', () => {
  let supabase: ReturnType<typeof createServerSupabaseClient>;

  beforeEach(async () => {
    supabase = createServerSupabaseClient();
  });

  afterEach(async () => {
    // Restore everything these tests touch
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', 'ORD002');
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', 'ORD005');
    await supabase.from('cases').update({ status: 'open', resolution: null }).eq('id', 'CASE001');
    await supabase.from('cases').update({ status: 'open', resolution: null }).eq('id', 'CASE002');
    await supabase.from('agent_actions').delete().eq('case_id', 'CASE001');
    await supabase.from('agent_actions').delete().eq('case_id', 'CASE002');
  });

  it('verifies a genuinely resolved case with all checks passing', async () => {
    const testCaseId = 'CASE001';

    // Ground truth: the case's own order (ORD002) really is cancelled.
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', 'ORD002');
    await supabase
      .from('cases')
      .update({ status: 'in_progress', resolution: { action: 'refund', order_id: 'ORD002', amount: 349.0 } })
      .eq('id', testCaseId);
    await supabase.from('agent_actions').insert({
      case_id: testCaseId,
      step: getNextStep(),
      tool: 'create_refund',
      input: { order_id: 'ORD002' },
      output: { order_id: 'ORD002', refund_status: 'processed', amount: 349.0 },
      status: 'success',
    });

    const result = await verifyCase(testCaseId, getNextStep(), { case_id: testCaseId });

    expect(result.verified).toBe(true);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ check: 'resolution_claimed', passed: true })
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ check: 'order_cancelled', passed: true })
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({ check: 'action_log_exists', passed: true })
    );
  });

  it('fails verification for non-existent case', async () => {
    const step = getNextStep();
    const result = await verifyCase('CASE001', step, { case_id: 'NONEXISTENT' });

    expect(result.verified).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ check: 'case_exists', passed: false })
    );
  });

  it('fails verification when the case has no resolution claim', async () => {
    const step = getNextStep();
    await supabase.from('cases').update({ status: 'open', resolution: null }).eq('id', 'CASE002');

    const result = await verifyCase('CASE001', step, { case_id: 'CASE002' });

    expect(result.verified).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ check: 'resolution_claimed', passed: false })
    );
  });

  it('fails verification when the claimed action did not change the order (falsely claimed)', async () => {
    const testCaseId = 'CASE001';

    // Claim a refund, but ORD002 is still delivered: the claim does not match the DB.
    await supabase.from('orders').update({ status: 'delivered' }).eq('id', 'ORD002');
    await supabase
      .from('cases')
      .update({ status: 'in_progress', resolution: { action: 'refund', order_id: 'ORD002', amount: 349.0 } })
      .eq('id', testCaseId);
    await supabase.from('agent_actions').insert({
      case_id: testCaseId,
      step: getNextStep(),
      tool: 'create_refund',
      input: { order_id: 'ORD002' },
      output: { order_id: 'ORD002', refund_status: 'processed', amount: 349.0 },
      status: 'success',
    });

    const result = await verifyCase(testCaseId, getNextStep(), { case_id: testCaseId });

    expect(result.verified).toBe(false);
    expect(result.checks).toContainEqual(
      expect.objectContaining({ check: 'order_cancelled', passed: false })
    );
  });

  it('logs verification action', async () => {
    const step = getNextStep();
    const testCaseId = 'CASE001';
    await verifyCase(testCaseId, step, { case_id: testCaseId });

    const { data: action } = await supabase
      .from('agent_actions')
      .select('tool, status')
      .eq('case_id', testCaseId)
      .eq('step', step)
      .single();

    expect(action?.tool).toBe('verify_case');
  });
});
