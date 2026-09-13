import { createServerSupabaseClient } from '@/lib/supabase/client';
import type { GetPolicyInput, GetPolicyOutput, PolicyRules } from '@/types';

const NOT_FOUND_CODES = ['PGRST116'];

export async function getPolicy(input: GetPolicyInput): Promise<GetPolicyOutput> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('policies')
    .select('id, policy_type, rules')
    .eq('policy_type', input.policy_type)
    .single();

  if (error) {
    if (NOT_FOUND_CODES.includes(error.code)) {
      throw new Error(`get_policy: policy '${input.policy_type}' not found`);
    }
    throw new Error(`get_policy failed: ${error.message}`);
  }

  const rules = (data.rules as unknown as PolicyRules) || {};

  return {
    id: data.id,
    policy_type: data.policy_type,
    rules,
  };
}
