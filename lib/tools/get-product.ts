import { createServerSupabaseClient } from '@/lib/supabase/client';
import type { GetProductInput, GetProductOutput } from '@/types';

const NOT_FOUND_CODES = ['PGRST116'];

export async function getProduct(input: GetProductInput): Promise<GetProductOutput> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price')
    .eq('id', input.product_id)
    .single();

  if (error) {
    if (NOT_FOUND_CODES.includes(error.code)) {
      throw new Error(`get_product: product '${input.product_id}' not found`);
    }
    throw new Error(`get_product failed: ${error.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    price: Number(data.price),
  };
}
