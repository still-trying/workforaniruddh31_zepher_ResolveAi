import { createServerSupabaseClient } from '@/lib/supabase/client';
import type { GetCustomerInput, GetCustomerOutput } from '@/types';

const NOT_FOUND_CODES = ['PGRST116'];

export async function getCustomer(input: GetCustomerInput): Promise<GetCustomerOutput> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, customer_tier')
    .eq('id', input.customer_id)
    .single();

  if (error) {
    if (NOT_FOUND_CODES.includes(error.code)) {
      throw new Error(`get_customer: customer '${input.customer_id}' not found`);
    }
    throw new Error(`get_customer failed: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    customer_tier: data.customer_tier,
  };
}
