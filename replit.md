# Mit Gaber Hyperlocal Marketplace

## Overview
A full-stack hyperlocal marketplace platform built with React (Vite) frontend, Node.js Express backend, and PostgreSQL via Drizzle ORM. Supports four roles: **Admin**, **Customer**, **Store Owner**, and **Driver**.

## Architecture
- **Frontend**: React + Vite, Wouter (routing), TanStack Query v5, shadcn/ui, Tailwind CSS
- **Backend**: Express.js with modular controllers/services
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: JWT stored in `localStorage` as `jwt_token`

## Key Roles & Routes
| Role | Landing | Key Pages |
|------|---------|-----------|
| ADMIN | `/admin/dashboard` | `/admin/users`, `/admin/stores`, `/admin/audit` |
| STORE_OWNER | `/store/dashboard` | `/store/dashboard/orders`, `/store/inventory`, `/store/earnings` |
| DRIVER | `/driver/tasks` | `/driver/wallet`, `/driver/active-delivery` |
| CUSTOMER | `/` | `/customer/wallet`, `/customer/transactions`, `/customer/profile`, `/customer/order/:id` |

## Store Owner Flow
- On registration: store record is automatically created in the DB (within the same transaction as user creation)
- Store owner is identified by finding a store where `ownerId === user.id` via `/api/stores`
- Products are fetched with `store_id` as a URL query param: `/api/products?store_id=<id>`
- Orders are fetched via `/api/orders/my-store` (requires `STORE_OWNER` or `ADMIN` role)
- Status workflow: `PENDING → ACCEPTED → READY` (managed by store owner)

## API Endpoints (Store Owner)
- `GET /api/stores` — list all stores (find own by `ownerId`)
- `GET /api/products?store_id=<id>` — get store's products (up to 200)
- `GET /api/orders/my-store` — get all sub-orders for the owner's store
- `GET /api/wallet` — get wallet balance
- `GET /api/ledger/transactions` — earnings history
- `PATCH /api/suborders/:id/status` — update order status
- `POST /api/products` — create product (requires `store_id` in body)
- `PATCH /api/products/:id` — update product
- `DELETE /api/products/:id` — delete product

## Financial System
- Double-entry inspired ledger: every commission/deposit/refund has a ledger entry
- Wallet stores running balance; ledger stores full history
- All financial mutations are wrapped in DB transactions

## Fixes Applied (Store Owner Flow)
1. Registered missing `/api/orders/my-store` backend route
2. Added missing `/store/dashboard` route in frontend router
3. Fixed store owner redirect from `/` to `/store/dashboard` (URL consistency)
4. Fixed products query to include `store_id` in URL (`/api/products?store_id=<id>`)
5. Fixed `ProductsService.mapToDTO()` to include both `id`/`storeId` (frontend schema) AND `product_id`/`store_id` (legacy DTO) fields
6. Increased default product page limit from 10 → 200
7. Updated all cache invalidation keys to match new URL-based queryKeys
8. **CRITICAL**: Fixed Wouter route ordering in `App.tsx` — `/store/dashboard`, `/store/earnings`, `/store/inventory`, `/store/order/:id` now come **before** the wildcard `/store/:id` route. Previously Wouter matched `/store/dashboard` as a public store page, sending requests to `/api/public/stores/dashboard` and returning 500 errors ("المتجر غير موجود").
9. Added UUID validation in `suborder.controller.ts` — non-UUID IDs now return 400 instead of crashing with a PostgreSQL syntax error (500).
10. Added UUID validation in `public.controller.ts` — non-UUID store IDs in `/api/public/stores/:id` now return 404 instead of a DB crash (500).

## Production Safety Audit (April 2026)

### Critical Bugs Fixed
1. **🔴 CRITICAL — Store Deletion on Every Startup**: `db-auto-verify.ts` contained test code that called `storage.deleteStore()` on ALL stores in the database every time the server restarted. **Removed entirely.**
2. **🔴 CRITICAL — All Users Auto-Approved**: The registration endpoint set `isApproved: true` for ALL users including `STORE_OWNER` and `DRIVER`, bypassing the admin approval flow entirely. Fixed: only `CUSTOMER` gets auto-approved; `STORE_OWNER` and `DRIVER` require admin approval.
3. **🟠 Double Rate Limiting**: `generalLimiter` was applied both in `server/index.ts` and inside `registerRoutes()`. Removed the duplicate from `registerRoutes()`.
4. **🟠 Duplicate `/api/health` endpoint**: A simple health check was registered twice. Removed the redundant simple one; kept the comprehensive one with DB checks.

### Security Improvements
5. **JWT token expiry**: Extended from `1d` to `7d` for better UX without significant security trade-off.
6. **Production Security Headers**: Added `Strict-Transport-Security (HSTS)`, `Content-Security-Policy (CSP)`, `Referrer-Policy`, and `Permissions-Policy` headers (production only).
7. **Login error messages**: Improved error messages for pending accounts to show Arabic text instead of generic "Account not approved".

### Stability Improvements
8. **DB Connection Pool**: Added explicit pool settings (`max: 20`, `idleTimeoutMillis: 30s`, `connectionTimeoutMillis: 5s`) and an error event handler to prevent silent pool failures under load.
9. **Registration UX for pending accounts**: Frontend now handles `pendingApproval: true` response correctly — shows a dedicated waiting screen instead of crashing/redirecting incorrectly.
10. **Login error handling**: Added `res.ok` check before Zod parsing in `use-auth.ts` so server error messages are correctly propagated to the user instead of showing a generic Zod error.

## Real-Time Chat System (Socket.IO)

### Room Types
| Type | Participants | Trigger |
|------|-------------|---------|
| `ORDER_STORE` | Customer ↔ Store Owner | Auto-created on sub-order creation |
| `ORDER_DRIVER` | Customer ↔ Driver | Auto-created on driver offer acceptance |
| `SUPPORT` | Any User ↔ Admin | User calls `POST /api/chat/support` |

### Chat API Endpoints
- `GET /api/chat/rooms` — list all rooms the user is a participant in
- `POST /api/chat/support` — open (or retrieve) a SUPPORT room for the current user
- `GET /api/chat/rooms/:id/messages` — fetch messages (paginated, newest last)
- `POST /api/chat/rooms/:id/messages` — send a message (only participants)
- `POST /api/chat/rooms/:id/read` — mark all unread messages as read
- `GET /api/chat/unread` — get total unread count for current user

### Socket.IO Events
- **Client → Server**: `join_room`, `send_message`, `mark_read`, `leave_room`
- **Server → Client**: `new_message`, `unread_update`, `marked_read`

### Frontend
- `/chat` — list of all chat rooms with unread badges
- `/chat/:roomId` — real-time chat room view
- Unread counter shown in all 4 role navbars (polling every 30s + real-time Socket.IO updates)
- `use-chat-socket.ts` hook handles Socket.IO connection lifecycle

### Key Files
- `server/modules/chat/chat.service.ts` — room/message CRUD + unread counts
- `server/modules/chat/chat.socket.ts` — Socket.IO event handlers
- `server/modules/chat/chat.controller.ts` — REST endpoints
- `client/src/pages/chat/index.tsx` — chat list page
- `client/src/pages/chat/room.tsx` — chat room page
- `client/src/hooks/use-chat-socket.ts` — Socket.IO hook

## Push Notification System (April 2026)

### Architecture
- **Web Push (Browser)**: Uses `web-push` library with VAPID keys stored as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` env vars
- **Real-time (Socket.IO)**: Online users receive notifications instantly via Socket.IO room `user:<userId>`
- **In-App Bell**: `NotificationBell` component shows history, unread count, and navigates on click
- **Service Worker**: `client/public/sw.js` handles background push events and click navigation

### Database Tables (auto-created on startup)
- `notifications` — stores all notification history per user
- `push_subscriptions` — stores browser push subscription endpoints per user
- `withdrawal_requests` — stores pending withdrawal requests from drivers
- `notification_type` enum — 13 types covering all platform events

### Notification Triggers Per Role
| Role | Event | Trigger |
|------|-------|---------|
| **Admin** | New driver/store registers | On registration of DRIVER or STORE_OWNER |
| **Admin** | New deposit submitted | On `POST /api/wallet/deposit` |
| **Admin** | New withdrawal requested | On `POST /api/wallet/withdraw` |
| **Store Owner** | New order received | On order creation |
| **Driver** | New delivery task available | When store ACCEPTS a sub-order (broadcast to ALL approved drivers) |
| **Driver** | Offer accepted/rejected/countered | When customer acts on delivery offer |
| **Customer** | Driver submitted offer | On `POST /api/delivery/suborders/:id/offer` |
| **Customer** | Order status changed | When store changes sub-order status |
| **Customer/Driver** | Account approved | When admin approves account |
| **Customer** | Deposit approved/rejected | When admin processes deposit |

### Notification Bell Navigation
Clicking a notification navigates to the relevant page based on type and user role:
- `NEW_ORDER` → Store orders page / Driver tasks page
- `NEW_OFFER` → Customer orders page
- `OFFER_ACCEPTED/REJECTED/COUNTERED` → Driver tasks
- `SYSTEM_ALERT` (admin) → Admin approvals page
- `WALLET_UPDATE/DEPOSIT/WITHDRAWAL` → Wallet page

### Key Files
- `server/modules/notifications/push.service.ts` — `PushService`, `notifyUser()`, `notifyAdmins()`, `notifyAllDrivers()`
- `server/modules/notifications/notification.routes.ts` — REST API for notifications and push subscriptions
- `client/src/hooks/use-notifications.ts` — frontend hook (push permission, subscription, real-time)
- `client/public/sw.js` — service worker (push events, click navigation)
- `client/src/components/ui/notification-bell.tsx` — UI component with role-based navigation

## Code Quality Audit (April 2026)

### Bugs Fixed
1. **Hardcoded delivery address**: `delivery.service.ts` returned `'Address placeholder'` as customer address. Fixed to read actual first address from `users.addresses` JSON column via `COALESCE((addresses->>0), 'لا يوجد عنوان محدد')`.
2. **`notification.service.ts` calling non-existent method**: Called `auditService.logAction()` which doesn't exist on the audit module. Fixed to call `auditService.insertAuditLog()` with the correct parameter shape.
3. **Seed data running in production**: `seedDatabase()` ran unconditionally on every server start. Fixed: now guarded with `process.env.NODE_ENV !== 'production'`.

### Audit Logging Improvements
4. **`delivery.service.ts`**: Replaced `console.log([AUDIT-DELIVERY] ...)` with actual `auditService.logEvent()` call writing to the `audit_logs` table.
5. **`products.service.ts`**: Replaced all four `console.log([AUDIT-PRODUCT] ...)` calls with proper `auditService.logEvent()` calls for CREATE, UPDATE, DELETE, and UPDATE_IMAGE actions.
6. **`ledger.service.ts`**: Removed redundant `console.log([AUDIT-LEDGER] ...)` (function already has full audit logging inside the transaction).
7. **`deposits.service.ts`**: Removed redundant `console.log([AUDIT-DEPOSIT] ...)` (function already has full audit logging inside the transaction).

### i18n Unification
8. **`login.tsx` and `register.tsx`**: Replaced local inline `t()` translation mock functions with the global `t()` imported from `@/i18n`. Eliminated code duplication and the "Temporary i18n mock" comments.
9. **`ar.ts`**: Added all missing auth translation keys (`auth.login.*` and `auth.register.*`) including nested `roles.*`, store/transport fields, and success/failure messages.

### Dead Code Removal
10. **`use-notification-stub.ts`**: Deleted unused stub file that contained mock notifications — it was not imported anywhere in the codebase and created confusion about which notification system was active.

## Deep-Dive Bug Audit (April 2026 - Round 2)

### Bugs Fixed

1. **🔴 Login: Duplicate `getUserByEmail` call (dead code)** — `server/routes.ts`: When the identifier was an email, `getUserByEmail` was called twice in a row with identical parameters. The second call was a leftover placeholder comment turned into code, wasting a DB round-trip on every email login. **Removed the duplicate.**

2. **🟠 Login: Inconsistent error language** — `server/routes.ts`: When bcrypt comparison failed (wrong password), the response was English `"Invalid credentials"` while all other auth errors returned Arabic messages. **Fixed to Arabic `"بيانات الدخول غير صحيحة"`.**

3. **🔴 Admin Stats: Hardcoded placeholder zeros** — `server/routes.ts` `/api/admin/stats`: `pendingOrders`, `cancelledOrders`, and `deliveredOrders` were always `0` (hardcoded placeholders). `platformCommissions` was also `"0.00"`. **Fixed: all values now query real counts from the `orders` and `ledger` tables.**

4. **🔴 Delivery Service: Filter chaining replaces WHERE clause** — `server/modules/delivery/delivery.service.ts`: When `store_id` or `category` filters were applied, each `.where()` call replaced the previous one instead of combining with it. This meant the base conditions (`status = 'ACCEPTED' AND assignedDriverId IS NULL`) were silently dropped when any filter was active — drivers could see non-ACCEPTED or already-assigned sub-orders. **Fixed: all conditions are now built into an array and combined with `and(...)` in a single `.where()` call.**

5. **🔴 Delivery Service: Total count ignores active filters** — `server/modules/delivery/delivery.service.ts`: The `total` count query used a separate, unfiltered `db.select().from(subOrders)` that did not apply `store_id` or `category` filters. The count misled pagination. **Fixed: count query now uses the same `combinedWhere` conditions as the data query.**

6. **🔴 Admin Order Cancellation: Missing ledger entry for refund** — `server/routes.ts` `PATCH /api/admin/orders/:id/status`: When an admin cancelled a paid order, the customer wallet was correctly credited and a `wallet_transactions` row was inserted, but no corresponding `ledger` entry was created. This broke the double-entry accounting integrity. **Fixed: a `WITHDRAWAL` ledger entry is now inserted within the same transaction.**

## Financial System Deep Audit (April 2026 - Round 3)

### Bugs Fixed

7. **🔴 `approveDeposit` missing ledger entry** — `wallet.service.ts`: When a deposit was approved, the wallet balance increased and the `wallet_transactions` status became COMPLETED, but NO `ledger` row was ever inserted. This silently broke double-entry accounting for every deposit. **Fixed: a DEPOSIT ledger entry is now inserted inside the same DB transaction.**

8. **🟠 `withdraw()` hardcoded `performedByRole: "DRIVER"`** — `wallet.service.ts`: The withdrawal audit log always recorded "DRIVER" as the actor role even though `STORE_OWNER` users can also withdraw (the route explicitly allows both roles). **Fixed: actor role is now fetched from the DB within the transaction and used dynamically.**

9. **🔴 `withdraw()` Race Condition — `getOrCreateWallet` outside transaction** — `wallet.service.ts`: `this.getOrCreateWallet(userId)` was called at the top of the `db.transaction()` callback, but the method uses the global `db` connection — NOT the transaction `tx`. If a wallet needed to be created and the transaction later rolled back, the wallet creation would NOT roll back, leaving the DB inconsistent. **Fixed: wallet is now looked up directly inside the transaction using `tx.select()`.**

10. **🟠 `withdraw()` no `walletTransactions` record created** — `wallet.service.ts`: When a withdrawal request was submitted, funds were immediately deducted from the wallet, but no `wallet_transactions` row was inserted to track this deduction. The only record created was a `withdrawal_requests` row. **Fixed: a PENDING WITHDRAWAL `walletTransactions` entry is now inserted inside the transaction.**

11. **🔴 Sub-order cancellation refund missing ledger entry** — `suborder.service.ts`: When a store owner or admin cancelled a sub-order, the customer's wallet was refunded but no `ledger` entry was created. **Fixed: a WITHDRAWAL ledger entry is now inserted alongside the wallet credit.**

12. **🔴 `customerAcceptOffer` delivery fee missing ledger entry** — `deliveryOffer.service.ts`: When a customer accepted a driver's delivery offer, the fee was deducted from the customer's wallet and a `wallet_transactions` row was inserted, but no `ledger` entry was created. **Fixed: a WITHDRAWAL ledger entry is now inserted inside the transaction.**

13. **🟠 `adminOverride` hid real errors behind silent `try/catch`** — `wallet.service.ts`: The ledger and audit log inserts inside `adminOverride` were wrapped in redundant `information_schema.tables` checks and broad `try/catch` blocks. This silently swallowed any real DB errors (e.g., constraint violations), making failures invisible. The tables are guaranteed to exist on startup. **Fixed: removed unnecessary existence checks and broad catches; operations now fail loudly if something goes wrong.**

## Frontend Bug Audit (April 2026 - Round 4)

### Bugs Fixed

14. **🟠 Debug `console.log` left in production** — `driver/tasks.tsx`: A `useEffect(() => { console.log("TASKS_PAGE_MOUNTED"); }, [])` block was left in the component after debugging. Also removed the now-unused `useEffect` import. **Fixed: removed entirely.**

15. **🔴 Balance displayed with `$` sign instead of `ج.م`** — `customer/wallet.tsx`: Two balance cards showed `$100.00` (literal `$` prefix before the JSX expression) instead of `100.00 ج.م`. Same bug appeared in two pending deposit and transaction table cells in the same file. **Fixed: corrected all 4 occurrences to use `{amount} ج.م`.**

16. **🟠 English validation error message** — `customer/wallet.tsx`: The `depositSchema` Zod refine message was `"Amount must be a positive number"` (English) while the entire app is Arabic. **Fixed: changed to `"يجب أن يكون المبلغ رقماً موجباً"`.**

17. **🔴 Earnings page: `fetch()` without auth headers** — `driver/earnings.tsx`: The ledger transactions query used the native `fetch()` with no Authorization header. Since `jwt_token` is required, all requests would return 401 and silently fail (showing empty transactions). **Fixed: replaced with `apiFetch()` which automatically attaches the `Bearer` token.**

18. **🔴 Wrong WITHDRAWAL filter label** — `driver/earnings.tsx`: The `SelectItem` for `value="WITHDRAWAL"` was using the translation key `customer.wallet.types.DEPOSIT` instead of `WITHDRAWAL`, causing the "سحب" filter to be labelled "إيداع". **Fixed: corrected the key to `WITHDRAWAL`.**

19. **🟠 Multiple `$` / `EGP` currency signs** — Across 9 files, amounts were displayed as `$100.00` or `100.00 EGP` instead of `100.00 ج.م`: `driver/earnings.tsx` (×3), `driver/dashboard.tsx`, `driver/wallet.tsx` (×3), `customer/orders.tsx`, `customer/transactions.tsx`, `admin/deposits.tsx`, `admin/orders.tsx`, `admin/products.tsx`, `admin/withdrawals.tsx`. **Fixed: all corrected to `{amount} ج.م`.**

20. **🔴 Critical — Wrong `localStorage` key in store earnings** — `customer/store/earnings.tsx`: The ledger transactions fetch used `localStorage.getItem("token")` instead of `"jwt_token"`, which always returns `null`. Every request was sent without an Authorization header, returning 401 and silently showing no data. **Fixed: replaced raw `fetch()` + wrong key with `apiFetch()` which reads the correct `jwt_token` key.**

21. **🟠 English UI text across admin pages** — Multiple admin pages had English labels, table headers, and toast messages: `admin/users.tsx` (page title "Users", table headers "Name/Contact/Role/Status/Joined/Actions", status badges "Approved/Pending", button title "Approve User", toasts "User Approved"/"Error"), `admin/stores.tsx` (toasts "Success"/"Error"/"Failed to create/delete store"), `admin/deposits.tsx` (error messages "Failed to fetch/approve/reject"), `admin/orders.tsx` ("Total: $..."), `admin/products.tsx` ("units"), `admin/audit.tsx` ("No audit logs found."), `customer/transactions.tsx` filter options ("Pending"/"Completed"/"Failed"). **Fixed: all replaced with Arabic equivalents.**

## Bug Audit Round 5 (April 2026)

### Bugs Fixed

22. **🔴 `INVALID_TRANSITION` error mismatch (500 instead of 400)** — `suborder.service.ts` threw `"BUSINESS_RULE_VIOLATION: Illegal state transition from X to Y"` but `suborder.controller.ts` checked `err.message === "INVALID_TRANSITION"`. The strings never matched, so every invalid status transition returned HTTP 500 instead of 400. **Fixed: service now throws exactly `"INVALID_TRANSITION"` to match the controller's guard.**

23. **🔴 Admin sidebar "Stores" link pointed to the PUBLIC stores page** — `admin-layout.tsx`: The nav item for Stores had `href: "/stores"` which routes to `PublicStoresPage` (the customer-facing store directory), not `/admin/stores` which is the admin store management page (`StoresPage`). Admin could not reach the store management UI from the sidebar. **Fixed: changed to `/admin/stores`.**

24. **🔴 Admin sidebar "Products" and "Orders" with no ADMIN role restriction** — `App.tsx`: The `/products` and `/orders` routes used `<ProtectedRoute component={...} />` with no `roles` prop, meaning ANY authenticated user (CUSTOMER, DRIVER, STORE_OWNER) could access admin management pages directly by URL. **Fixed: added `roles={["ADMIN"]}` to both routes and registered canonical `/admin/products` and `/admin/orders` aliases for the sidebar.**

25. **🔴 Admin orders page showed admin's own orders instead of all platform orders** — `admin/orders.tsx`: Used `useOrders().useOrders()` which calls `GET /api/orders` — a **per-user** endpoint (`getMyOrders`) that returns only the authenticated user's orders. Since the admin user has no orders, the page always showed "No orders processed yet" even when customer orders existed. **Fixed: replaced with a direct query to `GET /api/admin/orders` which returns all platform orders.**

26. **🟠 Driver tasks page "مسندة" badge always showed 0** — `driver/tasks.tsx`: The badge `مسندة: {tasks?.filter(t => t.status === 'ACCEPTED').length}` counted tasks with `ACCEPTED` status, but a driver is only assigned to a sub-order when its status becomes `IN_TRANSIT` (via `customerAcceptOffer`). No sub-order with `assignedDriverId` ever has status `ACCEPTED`. The badge was permanently 0. **Fixed: replaced with a single accurate "active delivery" (IN_TRANSIT) count and a "available tasks" count.**

27. **🟠 `getActiveDeliveryForDriver` included unreachable `ACCEPTED` status** — `suborder.service.ts`: The active delivery query filtered by `inArray(subOrders.status, ["ACCEPTED", "IN_TRANSIT"])`. A driver is only assigned (`assignedDriverId` set) when the status transitions to `IN_TRANSIT` — never in `ACCEPTED`. The `ACCEPTED` filter was dead code that could never match any real row. **Fixed: simplified to `eq(subOrders.status, "IN_TRANSIT")` and removed unused `inArray` import.**
