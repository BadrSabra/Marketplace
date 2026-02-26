export interface ApproveDepositDTO {
  force?: boolean;
  notes?: string;
}

export interface ApproveDepositResponse {
  deposit_id: string;
  ledger_entry_id: string;
  status: 'APPROVED' | 'FAILED';
  message: string;
}
