import { createServerSupabaseClient } from '@/lib/supabase/client';
import { logAction } from './log-action';
import type { VerifyCaseInput, VerificationCheck } from '@/types';

interface VerifyResult {
  verified: boolean;
  checks: VerificationCheck[];
}

export async function verifyCase(
  caseId: string,
  step: number,
  input: VerifyCaseInput
): Promise<VerifyResult> {
  const supabase = createServerSupabaseClient();
  const checks: VerificationCheck[] = [];

  // Get the case
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('id, status, resolution, order_id')
    .eq('id', input.case_id)
    .single();

  if (caseError || !caseData) {
    checks.push({
      check: 'case_exists',
      passed: false,
      detail: `Case '${input.case_id}' not found`,
    });
    return { verified: false, checks };
  }

  // Here is the resolution the agent is claiming. This deliberately does NOT require the case to
  // already be terminal: the loop writes the claim, then verification decides whether the case
  // resolves (ROADMAP.md Phase 6: never resolved unless verification passes).
  const resolution = caseData.resolution as Record<string, unknown> | null;
  const claimedAction = resolution?.action;

  if (typeof claimedAction === 'string') {
    checks.push({
      check: 'resolution_claimed',
      passed: true,
      detail: `Case claims action '${claimedAction}'`,
    });
  } else {
    checks.push({
      check: 'resolution_claimed',
      passed: false,
      detail: `No resolution action recorded for case '${input.case_id}'`,
    });
  }

  // Get the order
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, price')
    .eq('id', caseData.order_id)
    .single();

  if (!order) {
    checks.push({
      check: 'order_exists',
      passed: false,
      detail: `Order '${caseData.order_id}' not found`,
    });
  } else {
    checks.push({
      check: 'order_exists',
      passed: true,
      detail: `Order '${order.id}' found`,
    });

    // Check the claimed action's effect actually exists in the DB
    if (resolution?.action === 'refund' || resolution?.action === 'replacement') {
      // For refund/replacement, order should be cancelled
      if (order.status !== 'cancelled') {
        checks.push({
          check: 'order_cancelled',
          passed: false,
          detail: `Order status is '${order.status}', expected 'cancelled' for ${resolution.action}`,
        });
      } else {
        checks.push({
          check: 'order_cancelled',
          passed: true,
          detail: `Order '${order.id}' is cancelled`,
        });
      }
    } else if (resolution?.action === 'cancel' || resolution?.action === 'return') {
      if (order.status !== 'cancelled') {
        checks.push({
          check: 'order_cancelled',
          passed: false,
          detail: `Order status is '${order.status}', expected 'cancelled'`,
        });
      } else {
        checks.push({
          check: 'order_cancelled',
          passed: true,
          detail: `Order '${order.id}' is cancelled`,
        });
      }
    }
  }

  // Check agent_actions trail exists
  const { data: actions, error: actionsError } = await supabase
    .from('agent_actions')
    .select('id, step, tool, status')
    .eq('case_id', input.case_id)
    .order('step', { ascending: true });

  if (actionsError || !actions || actions.length === 0) {
    checks.push({
      check: 'action_log_exists',
      passed: false,
      detail: `No agent_actions found for case '${input.case_id}'`,
    });
  } else {
    checks.push({
      check: 'action_log_exists',
      passed: true,
      detail: `${actions.length} actions logged`,
    });

    // Check for blocked/error actions that weren't followed by successful replan
    // A blocked action is "resolved" if a subsequent successful action of a different type occurs
    const actionTools = actions.map(a => ({ tool: a.tool, status: a.status }));
    let hasUnresolvedBlocks = false;
    
    for (let i = 0; i < actionTools.length; i++) {
      const action = actionTools[i];
      if (action.status === 'blocked' || action.status === 'error') {
        // Check if there's a subsequent successful action tool (different tool)
        const hasSuccessfulReplan = actionTools.slice(i + 1).some(
          a => a.status === 'success' && a.tool !== action.tool
        );
        if (!hasSuccessfulReplan) {
          hasUnresolvedBlocks = true;
          break;
        }
      }
    }
    
    if (hasUnresolvedBlocks) {
      checks.push({
        check: 'no_unresolved_blocks',
        passed: false,
        detail: 'Blocked/error actions were not followed by a successful replan',
      });
    } else {
      checks.push({
        check: 'no_unresolved_blocks',
        passed: true,
        detail: 'All blocked/error actions were followed by successful replan',
      });
    }
  }

  const verified = checks.every((c) => c.passed);

  // Log the verification action
  await logAction({
    case_id: caseId,
    step,
    tool: 'verify_case',
    input: { case_id: input.case_id },
    output: {
      case_id: input.case_id,
      verified,
      checks: checks.map((c) => ({
        check: c.check,
        passed: c.passed,
        detail: c.detail,
      })),
    },
    status: verified ? 'success' : 'error',
  });

  return { verified, checks };
}
