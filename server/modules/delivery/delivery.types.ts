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
  status: 'PENDING' | 'ACCEPTED' | 'READY';
  assigned_driver_id?: string | null;
}

export interface GetAvailableTasksFilters {
  page?: number;
  limit?: number;
  store_id?: string;
  category?: string;
}
