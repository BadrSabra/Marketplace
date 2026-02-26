export interface LedgerEntryDTO {
  entry_id: string;
  user_id: string;
  sub_order_id: string;
  type: 'COMMISSION' | 'REFUND' | 'ADJUSTMENT';
  amount: number;
  currency: string;
  status: 'COMPLETED' | 'PENDING';
  created_at: string;
  description?: string;
}

export interface CommissionResult {
  ledger_entry_ids: string[];
  success: boolean;
  message: string;
}
