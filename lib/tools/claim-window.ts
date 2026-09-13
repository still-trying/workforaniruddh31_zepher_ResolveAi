import type { PolicyRules } from '@/types';

/**
 * Shared policy time-window helper for the action tools.
 *
 * Two windows exist in the seeded policies (ARCHITECTURE.md Section 3):
 *  - damaged_item.claim_window_days   — governs replacement and refund claims
 *  - cancellation.return_window_days  — governs a return after shipping
 *
 * Both are measured from the order's delivery date, falling back to order_date when the order has
 * not been delivered yet. Keeping the date math here means no two tools can disagree about it.
 */

export interface PolicyWindowOrder {
  order_date: string;
  delivery_date: string | null;
}

export interface PolicyWindowEvaluation {
  /** True when the action is still inside the policy window (or no window is configured). */
  withinWindow: boolean;
  windowDays: number | null;
  daysSinceStart: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function evaluateWindow(order: PolicyWindowOrder, windowDays: number | null): PolicyWindowEvaluation {
  // No configured window (or no usable anchor date) means the action is not time-limited.
  const anchor = order.delivery_date ?? order.order_date;
  const anchorMs = Date.parse(anchor);
  if (windowDays === null || Number.isNaN(anchorMs)) {
    return { withinWindow: true, windowDays, daysSinceStart: null };
  }

  const daysSinceStart = Math.floor((Date.now() - anchorMs) / MS_PER_DAY);
  return { withinWindow: daysSinceStart <= windowDays, windowDays, daysSinceStart };
}

export function evaluateClaimWindow(order: PolicyWindowOrder, rules: PolicyRules): PolicyWindowEvaluation {
  const windowDays = typeof rules.claim_window_days === 'number' ? rules.claim_window_days : null;
  return evaluateWindow(order, windowDays);
}

export function evaluateReturnWindow(order: PolicyWindowOrder, rules: PolicyRules): PolicyWindowEvaluation {
  const windowDays = typeof rules.return_window_days === 'number' ? rules.return_window_days : null;
  return evaluateWindow(order, windowDays);
}
