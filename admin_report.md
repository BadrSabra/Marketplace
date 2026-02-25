# Admin Module Status Report

## 1. Page & Component Inventory
*   **`dashboard.tsx`**: High-level overview with summary cards and mocked activity feed.
*   **`users.tsx`**: Management table for all user roles; supports approval of `PENDING` accounts.
*   **`stores.tsx`**: List and manual creation of stores. Currently lacks a `PENDING` approval flow for new stores.
*   **`orders.tsx`**: List of all platform orders.
*   **`products.tsx`**: List of all platform products.
*   **`approvals.tsx` (NEW)**: Centralized landing for multi-entity approvals (Drivers, Stores, Deposits).
*   **`finance.tsx` (NEW)**: Detailed ledger and wallet transaction monitoring.

## 2. Backend Endpoint Mapping
| Feature | Endpoint | Method | Status |
| :--- | :--- | :--- | :--- |
| **User Approval** | `/api/admin/users/:id/approve` | `PATCH` | ✅ Implemented |
| **Store Approval** | *N/A* | `PATCH` | ❌ Missing (Stores are currently auto-approved or created by Admin) |
| **Deposit Approval** | `/api/wallet/deposits/:id/approve` | `POST` | ✅ Implemented |
| **Stats/Reporting** | `/api/admin/reports/stats` | `GET` | ✅ Implemented |

## 3. Identified Gaps & Missing UI
*   **Driver Approval**: Drivers are currently approved via the generic User Approval. A dedicated view to verify "Transport Type" or "License Uploads" (if added) is missing.
*   **Wallet Deposits**: No dedicated UI page exists to list pending deposits; currently only available via API.
*   **Historical Metrics**: The dashboard only shows current snapshots. No time-series data for growth or revenue trends.
*   **Activity Feed**: Currently contains static mock data. Needs a real-time event stream from the database.

## 4. Transactional Integrity Audit
*   **Wallet/Ledger**: ✅ **Strong**. `ledger.service.ts` uses `db.transaction` for all balance updates (`holdFunds`, `releaseFunds`, `refundFunds`), ensuring balance and transaction logs never drift.
*   **Atomicity**: ✅ **Verified**. Multi-store order creation and sub-order cancellations are wrapped in database transactions.

## 5. Recommendations
1.  **Centralize Approvals**: Create a single "Pending Actions" queue that combines User, Store, and Deposit approvals.
2.  **Finance View**: Implement the `finance.tsx` page to visualize the platform's total liability (sum of all wallet balances) vs. total revenue.
3.  **Real-time Feed**: Implement a basic "Audit Log" table to power the dashboard activity feed instead of mocking it.

```json
{
  "module": "Admin",
  "status": "Functional - Needs UI Consolidation",
  "audit": {
    "transactions": "Atomic / Verified",
    "ledger": "Service-based / Verified"
  },
  "gaps": {
    "ui": ["Centralized Approval Queue", "Deposit Management UI", "Historical Revenue Charts"],
    "api": ["Store Approval Workflow", "Activity Log Stream"]
  }
}
```
