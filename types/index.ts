export interface Customer {
  id: string;
  name: string;
  email: string;
  customer_tier: string;
  created_at?: Date;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface Inventory {
  product_id: string;
  available_quantity: number;
  warehouse: string;
}

export interface Order {
  id: string;
  customer_id: string;
  product_id: string;
  status: 'placed' | 'shipped' | 'delivered' | 'cancelled';
  order_date: string;
  delivery_date: string | null;
  price: number;
}

export interface PolicyRules {
  replacement_allowed?: boolean;
  refund_allowed?: boolean;
  claim_window_days?: number;
  cancellation_allowed?: boolean;
  cancellation_allowed_after_shipping?: boolean;
  return_allowed_after_shipping?: boolean;
  return_window_days?: number;
  refund_requires_approval?: boolean;
  approval_threshold?: number;
  auto_refund_tiers?: string[];
}

export interface Policy {
  id: string;
  policy_type: string;
  rules: PolicyRules;
}

export interface Case {
  id: string;
  customer_id: string;
  order_id: string;
  customer_message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  resolution: Record<string, unknown> | null;
  created_at?: string;
}

export interface AgentAction {
  id: number;
  case_id: string;
  step: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'success' | 'blocked' | 'error';
  timestamp: string;
}

// Tool input/output types
export interface GetCustomerInput {
  customer_id: string;
}

export interface GetCustomerOutput {
  id: string;
  name: string;
  email: string;
  customer_tier: string;
}

export interface GetOrderInput {
  order_id: string;
}

export interface GetOrderOutput {
  id: string;
  customer_id: string;
  product_id: string;
  status: string;
  order_date: string;
  delivery_date: string | null;
  price: number;
}

export interface GetProductInput {
  product_id: string;
}

export interface GetProductOutput {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface GetInventoryInput {
  product_id: string;
}

export interface GetInventoryOutput {
  product_id: string;
  available_quantity: number;
  warehouse: string;
}

export interface GetPolicyInput {
  policy_type: string;
}

export interface GetPolicyOutput {
  id: string;
  policy_type: string;
  rules: PolicyRules;
}

export interface CreateRefundInput {
  order_id: string;
}

export interface CreateRefundOutput {
  order_id: string;
  refund_status: string;
  amount: number;
}

export interface CreateReplacementInput {
  order_id: string;
}

export interface CreateReplacementOutput {
  order_id: string;
  replacement_status: string;
  new_order_id: string;
}

export interface CancelOrderInput {
  order_id: string;
}

export interface CancelOrderOutput {
  order_id: string;
  status: string;
}

export interface CreateReturnInput {
  order_id: string;
}

export interface CreateReturnOutput {
  order_id: string;
  return_status: string;
}

export interface VerifyCaseInput {
  case_id: string;
}

export interface VerificationCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface VerifyCaseOutput {
  case_id: string;
  verified: boolean;
  checks: VerificationCheck[];
}
