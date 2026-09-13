import { createServerSupabaseClient } from '@/lib/supabase/client';
import type { GetInventoryInput, GetInventoryOutput } from '@/types';

const NOT_FOUND_CODES = ['PGRST116'];

export async function getInventory(input: GetInventoryInput): Promise<GetInventoryOutput> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('inventory')
    .select('product_id, available_quantity, warehouse')
    .eq('product_id', input.product_id)
    .single();

  if (error) {
    if (NOT_FOUND_CODES.includes(error.code)) {
      throw new Error(`get_inventory: no inventory found for product '${input.product_id}'`);
    }
    throw new Error(`get_inventory failed: ${error.message}`);
  }

  return {
    product_id: data.product_id,
    available_quantity: data.available_quantity,
    warehouse: data.warehouse,
  };
}
