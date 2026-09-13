import { createServerSupabaseClient } from '@/lib/supabase/client';
import type { GetOrderInput, GetOrderOutput } from '@/types';

const NOT_FOUND_CODES = ['PGRST116'];

export async function getOrder(input: GetOrderInput): Promise<GetOrderOutput> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, customer_id, product_id, status, order_date, delivery_date, price')
    .eq('id', input.order_id)
    .single();

  if (error) {
    if (NOT_FOUND_CODES.includes(error.code)) {
      throw new Error(`get_order: order '${input.order_id}' not found`);
    }
    throw new Error(`get_order failed: ${error.message}`);
  }

  return {
    id: data.id,
    customer_id: data.customer_id,
    product_id: data.product_id,
    status: data.status,
    order_date: data.order_date,
    delivery_date: data.delivery_date,
    price: Number(data.price),
  };
}
