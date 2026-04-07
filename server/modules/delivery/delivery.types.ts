export interface AvailableTaskDTO {
  sub_order_id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  customer_name: string;
  customer_address: string;
  items: { product_name: string; quantity: number }[];
  subtotal: number;
  created_at: string;
  status: 'PENDING' | 'ACCEPTED' | 'IN_TRANSIT';
  assigned_driver_id?: string | null;
  driver_offer_status?: string | null;
  driver_offered_fee?: string | null;
}

export interface GetAvailableTasksFilters {
  page?: number;
  limit?: number;
  store_id?: string;
  category?: string;
}
