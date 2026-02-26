import { LedgerService } from '../ledger.service';

describe('LedgerService', () => {
  let ledgerService: LedgerService;

  beforeEach(() => {
    ledgerService = new LedgerService();
  });

  it('should be defined', () => {
    expect(ledgerService).toBeDefined();
  });

  it('should have getTransactions method', () => {
    expect(ledgerService.getTransactions).toBeDefined();
  });

  it('should have getTransactionById method', () => {
    expect(ledgerService.getTransactionById).toBeDefined();
  });
});
