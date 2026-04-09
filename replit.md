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

## Q&A Code Audit & Fixes (April 2026)

### Bugs Fixed with Q&A Documentation

#### Backend Fixes
1. **`/api/auth/me` missing walletBalance** — The login endpoint returns `walletBalance` but `/api/auth/me` did not. After page refresh, wallet balance was lost. Fixed: `walletService.getOrCreateWallet()` called in the me endpoint and `walletBalance` added to response.
   - *New error revealed*: If a user exists without a wallet (edge case), `getOrCreateWallet` will silently create one and return `"0.00"`, which may be incorrect for users with real balances in legacy data.

2. **`createDeposit` used `as any` cast** — Suppressed TypeScript errors on enum types in `wallet.service.ts`. Fixed: replaced with `as const` for proper type inference.
   - *New error revealed*: Any future change to the `transaction_type` enum values will now cause a compile-time error rather than a silent runtime failure.

3. **`getCustomerOrders` N+1 query** — Each order triggered 6–8 DB queries via `getOrderWithSubOrders`. Fixed: added `limit`/`offset` pagination (default 20, max 50).
   - *New error revealed*: Frontends not using pagination will silently receive only the 20 most recent orders instead of all orders.

4. **`ledger.service.ts` status filter silently ignored** — `filters.status` was accepted but never applied (ledger table has no `status` column). Fixed: now logs a warning instead of silently ignoring.
   - *New error revealed*: Admin dashboards filtering by status will see a console warning, making the missing status column visible for the first time.

5. **`storage.ts` `createUser` used `as any`** — Bypassed TypeScript type checking between `InsertUser` (drizzle-zod) and Drizzle ORM insert type. Fixed: switched to `as DrizzleInsertUser` for explicit type alignment.
   - *New error revealed*: Any field type mismatch between the Zod schema and Drizzle ORM schema (e.g., `addresses: null` vs `undefined`) will now cause a TypeScript error.

#### Frontend Fixes
6. **`queryClient.ts` 401 handling inconsistency** — `getQueryFn` with `on401: "throw"` threw an error without redirecting to login, while `apiFetch` did redirect. Fixed: unified behavior — `getQueryFn` now clears token and redirects on 401.
   - *New error revealed*: Components using `isError` to show fallback UI on 401 will now redirect instead, changing behavior for pages that expected an error state.

7. **`api.ts` concurrent 401 race condition** — Multiple parallel requests failing with 401 would each attempt `window.location.href = "/login"`, causing multiple history entries. Fixed: added `_isRedirecting` guard flag.
   - *New error revealed*: If the guard flag is not reset properly (e.g., during HMR in development), subsequent 401 errors after the first redirect will be silently ignored.

8. **`shared/routes.ts` type missing walletBalance** — `userWithoutPassword` type didn't include `walletBalance`, causing TypeScript to flag access to `user.walletBalance` in components. Fixed: updated type to include `walletBalance?: string`.
   - *New error revealed*: Components that assumed `walletBalance` was always present (not optional) will now need to handle the `undefined` case explicitly.

9. **`use-orders.ts` pagination not forwarded** — Hook called `/api/orders/my-orders` without pagination parameters after backend added `limit`/`offset` support. Fixed: hook now accepts and forwards `limit`/`offset` parameters.
   - *New error revealed*: Components using `useMyOrders()` without arguments will receive 20 orders instead of all orders.

#### Session 2 Fixes (Continuation)
10. **Dead code deleted** — `server/modules/deposits/deposits.service.ts` and `shared/deposits.schema.ts` referenced a `deposits` table that never existed in the DB. Both files deleted. The active deposit flow uses `walletService` + `wallet_transactions` table (not this dead code).
    - *New error revealed*: Any future code importing from these paths will now get a clear compile error instead of a silent runtime crash.

11. **`generateOtp` made idempotent** — Two concurrent GET requests for the same order both triggered OTP generation, where the second invalidated the first. Fixed: `generateOtp` now checks for a valid existing OTP both outside (fast path) and inside the transaction (double-check). Returns the existing code if found — no new generation.
    - *New error revealed*: Expired OTPs will no longer auto-regenerate on page load. Frontend needs a "Refresh OTP" button that calls `POST /api/orders/suborders/:id/regenerate-otp` with `forceNew=true` for the case where the user's OTP has expired.

12. **Uploaded file cleanup on delete** — Deleting a product or store left orphaned image files in `uploads/`. Fixed: `deleteProduct` fetches `imageUrl` before deleting DB record, then calls `deleteUploadedFile()`. `deleteStore` collects all product and store image URLs before the transaction and cleans up via `setImmediate` after commit (outside transaction — filesystem operations can't be rolled back).
    - *New error revealed*: If server restarts between transaction commit and `setImmediate` callback, file cleanup is silently skipped. A true fix requires an outbox pattern or a startup cleanup job for orphaned files.

13. **Push notification retry logic** — Web push failures from transient network errors (5xx, ECONNRESET) were silently dropped. Fixed: added one retry after 1 second for non-410/404 errors. 410/404 still immediately marks subscriptions for cleanup via `inArray` delete.
    - *New error revealed*: If the push provider rate-limits aggressively, the retry could generate a second 429 response. Full fix requires exponential backoff with jitter.

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

28. **🔴 `StoreCard` used wrong field `store.logoUrl` instead of `store.imageUrl`** — `client/src/components/home/StoreCard.tsx`: The store schema only defines `imageUrl` (maps to `image_url` in DB). `StoreCard` checked `store.logoUrl` which is always `undefined`, so the store cover image never displayed on the customer home page — always showing the placeholder icon. **Fixed: changed to `store.imageUrl`.**

29. **🟠 Store owner layout shows `$` currency (3 places)** — `client/src/components/layout/store-layout.tsx`: The wallet balance in the sidebar, mobile header, and mobile menu dropdown all displayed as `$XX.XX` instead of `XX.XX ج.م`. **Fixed: all three corrected to `{balance} ج.م`.**

30. **🟠 Store owner dashboard shows `$` currency** — `client/src/pages/customer/store/dashboard.tsx`: The wallet balance stat card displayed `$XX.XX`. **Fixed: corrected to `{balance} ج.م`.**

31. **🟠 Store owner earnings WITHDRAWAL filter labelled as "إيداع"** — `client/src/pages/customer/store/earnings.tsx` line 186: `<SelectItem value="WITHDRAWAL">` used translation key `customer.wallet.types.DEPOSIT` (copy-paste error), making the "سحب" filter show "إيداع" as its label. **Fixed: changed to `customer.wallet.types.WITHDRAWAL`.**

32. **🔴 OTP verify endpoint missing role guard** — `server/routes.ts`: `POST /api/delivery/otp/verify/:id` had only `authenticate` + `otpLimiter` but no `authorizeRole`. Since the **driver** enters the OTP (received from the customer) to confirm delivery, any authenticated user (customer, store owner, admin) could call this endpoint and mark a delivery as completed. **Fixed: added `authorizeRole(["DRIVER"])`.**

33. **🔴 Available delivery tasks endpoint missing role guard** — `server/routes.ts`: `GET /api/delivery/available-tasks` had only `authenticate` — no `authorizeRole(["DRIVER"])`. Any authenticated user could fetch the list of pending sub-orders available for driver pickup, exposing internal order data. **Fixed: added `authorizeRole(["DRIVER"])`.**

34. **🔴 Driver license upload overwrites avatar image** — `client/src/pages/driver/profile.tsx` + `server/routes.ts`: The license upload (`handleLicenseUpload`) called `POST /api/profile/avatar` which updates `users.avatarUrl` in the DB, not `users.driversLicenseUrl`. This silently replaced the driver's profile photo with their license image. **Fixed: added a new dedicated `POST /api/profile/license` endpoint that saves to `driversLicenseUrl`; updated the frontend to call this new endpoint and read `data.driversLicenseUrl` from the response.**

35. **🟠 `getActiveDeliveryForDriver` included unreachable `ACCEPTED` status** — `suborder.service.ts`: The active delivery query filtered by `inArray(subOrders.status, ["ACCEPTED", "IN_TRANSIT"])`. A driver is only assigned (`assignedDriverId` set) when the status transitions to `IN_TRANSIT` — never in `ACCEPTED`. The `ACCEPTED` filter was dead code that could never match any real row. **Fixed: simplified to `eq(subOrders.status, "IN_TRANSIT")` and removed unused `inArray` import.**

## Bug Audit Round 6 (April 2026)

### Bugs Fixed

36. **🔴 Customer wallet filter "PAYMENT" never returns results** — `client/src/pages/customer/wallet.tsx`: The filter dropdown had `<SelectItem value="PAYMENT">` but the `ledger` table uses type `"WITHDRAWAL"` for order payments — `"PAYMENT"` is not a valid ledger type and will never match any record. Every customer who selected the "دفع" filter would see an empty list. **Fixed: changed value to `"WITHDRAWAL"`.**

37. **🔴 Missing `WITHDRAWAL` translation key** — `client/src/locales/ar/translation.json`: The `customer.wallet.types` section only contained `DEPOSIT`, `PAYMENT`, `REFUND`, `COMMISSION`. Since `PAYMENT` was renamed to `WITHDRAWAL` and the translation for `WITHDRAWAL` was missing, every transaction of type `WITHDRAWAL` would display its raw key `customer.wallet.types.WITHDRAWAL` in the UI instead of Arabic text. **Fixed: replaced `"PAYMENT": "دفع"` with `"WITHDRAWAL": "سحب/دفع"` and removed `REFUND` (not a valid ledger type).**

38. **🔴 Customer wallet filter "REFUND" never returns results** — `client/src/pages/customer/wallet.tsx`: The filter had `<SelectItem value="REFUND">`. The `ledger` table does not have a `REFUND` type — refunds are recorded as `DEPOSIT` entries. Selecting "REFUND" always returned an empty list. **Fixed: removed the REFUND filter option entirely.**

39. **🔴 Order ID column always shows "-" in wallet transaction history** — `client/src/pages/customer/wallet.tsx`: The table cell rendered `{tx.referenceId || "-"}` but the `ledger.service.ts` API returns the field as `related_order_id` (not `referenceId`). The property was always `undefined`, so every transaction showed "-" in the Order ID column. **Fixed: changed to `tx.related_order_id ? tx.related_order_id.slice(0, 8) : "-"`.**

40. **🟡 Missing rating range validation (1–5)** — `shared/schema.ts`: `insertRatingSchema` was generated directly from Drizzle's `createInsertSchema` with no additional constraints. The `rating` column only has a comment `// Should be 1-5` but no enforcement — any integer (0, -1, 100) could be stored. **Fixed: added `.extend({ rating: z.number().int().min(1).max(5) })` to enforce the 1–5 range at the schema level.**

41. **🟠 `/api/wallet/pending` fetched ALL users' deposits then filtered in memory** — `server/routes.ts`: The route called `walletService.getPendingDeposits()` (which returns every user's pending deposits), then filtered the result array in JavaScript with `deposits.filter(d => d.user.id === userId)`. As the platform grows, this loads unbounded data into memory on every request. **Fixed: replaced with a direct DB query scoped to the current user's wallet using `eq(wallets.userId, userId)` in the WHERE clause.**

## Bug Audit Round 7 (April 2026)

### Bugs Fixed

42. **🔴 Driver earnings `tx.referenceId` always undefined** — `client/src/pages/driver/earnings.tsx` line 149: The table cell rendered `{tx.referenceId || "-"}` but the `/api/ledger/transactions` endpoint returns the field as `related_order_id` (snake_case). The property was always `undefined`, so every transaction showed "-" in the Order ID column. Same root cause as bug #39 in the customer wallet, but affecting the driver earnings page. **Fixed: changed to `tx.related_order_id ? tx.related_order_id.slice(0, 8) : "-"`.**

43. **🔴 Driver earnings "REFUND" filter always returns empty** — `client/src/pages/driver/earnings.tsx` line 120: Had `<SelectItem value="REFUND">`. The `ledger` table has no `REFUND` type — refunds are recorded as `DEPOSIT`. Selecting this filter always returned zero results. Same issue as bug #38 in the customer wallet. **Fixed: removed the REFUND SelectItem entirely.**

44. **🔴 Active delivery page shows `$25.00` instead of `25.00 ج.م`** — `client/src/pages/driver/active-delivery.tsx` line 115: The total value was rendered as `${task.subtotal}` in JSX — since `$` is a literal character in JSX (not a template literal), it displayed as `$25.00` instead of using the Egyptian Pound symbol. **Fixed: changed to `{task.subtotal} ج.م`.**

45. **🔴 Counter-offer accept sends NEW offer instead of calling `accept-counter` endpoint** — `client/src/pages/driver/tasks.tsx`: When `offerCountered === true`, the "قبول اقتراح العميل" button opened the offer dialog and called `submitOfferMutation.mutate()` which posts to `/api/delivery/suborders/:id/offer` — creating a brand new offer. The correct call is `POST /api/delivery/offers/:offerId/accept-counter`. Additionally, the `/api/delivery/available-tasks` response did not include the `offer_id` at all, making it impossible to call the correct endpoint. **Fixed: (1) added `offer_id` to `deliveryOffersMap` and the `AvailableTaskDTO` in the backend; (2) added `driver_offer_id` to the frontend `AvailableTask` type; (3) added `acceptCounterOffer(offerId)` API function in `driver.ts`; (4) added `useAcceptCounterOffer` hook in `use-driver.ts`; (5) updated the button in `tasks.tsx` to call `handleAcceptCounter()` which invokes the correct endpoint directly.**

## Bug Audit Round 8 (April 2026)

### Bugs Fixed

46. **🔴 Public store listing exposes stores owned by unapproved users** — `server/modules/public/public.controller.ts`: `getStores()` and `getStore()` queried the `stores` table with no join to `users`. The `users` table has `isApproved` (approved store owners vs. pending), but the public endpoint never checked it. Any customer browsing the main store discovery page (`/api/public/stores`) would see stores from unapproved owners — the very stores that admin hasn't reviewed yet. **Fixed: added `.innerJoin(users, eq(stores.ownerId, users.id)).where(eq(users.isApproved, true))` to both `getStores` and `getStore` to enforce the approval gate.**

47. **🔴 Store orders filter shows `READY` and `PICKED_UP` — both invalid sub-order statuses** — `client/src/pages/customer/store/orders.tsx` lines 159-160 and 67-73: The filter dropdown offered `READY` and `PICKED_UP` as selectable options, and the badge style map contained those same keys. The sub-orders table uses `orderStatusEnum` (`PENDING, ACCEPTED, IN_TRANSIT, DELIVERED, CANCELLED`) — `READY` and `PICKED_UP` do not exist in this enum and can never appear in any row. Selecting either filter always returned an empty list, and the badge for the real status `IN_TRANSIT` had no styling (fell through to unstyled). **Fixed: replaced `READY`/`PICKED_UP` with `IN_TRANSIT` in both the filter SelectItems and the badge variants map, and replaced the translation keys accordingly (`store.orders.statuses.READY`/`PICKED_UP` → `IN_TRANSIT`).**

## Admin UI & i18n Audit (April 2026 - Round 9)

### Bugs Fixed

48. **🔴 Missing 200+ Arabic translation keys** — `client/src/i18n/ar.ts`: Only ~40 auth keys were defined but 200+ keys were actively used across all store, customer, and driver pages. All pages using `t()` were showing the raw key path (e.g., `store.inventory.title`) as text in the UI instead of Arabic. **Fixed: added comprehensive translations for all missing keys including `store.dashboard.*`, `store.orders.*`, `store.inventory.*` (including form fields), `store.earnings.*`, `store.order_details.*`, `customer.wallet.*`, `customer.transactions.*`, `driver.dashboard.*`, `driver.earnings.*`, `driver.active_delivery.*`.**

49. **🟠 i18n function didn't support variable interpolation** — `client/src/i18n/index.ts`: The `t()` function only accepted a key string and had no way to inject dynamic values (e.g., `{time}` or `{page}`). Pages calling `t('driver.active_delivery.estimated_delivery', { time: ... })` ignored the second arg entirely. **Fixed: updated `t()` to accept an optional `Record<string, string|number>` second parameter and perform `{variable}` string replacement.**

50. **🔴 Admin layout displayed "MarketAdmin" (English) as platform name** — `client/src/components/layout/admin-layout.tsx`: Both the desktop sidebar header and mobile header showed the hardcoded English text "MarketAdmin". **Fixed: replaced with Arabic "ميت جابر" with subtitle "لوحة الإدارة".**

51. **🟠 Admin layout was not RTL** — `client/src/components/layout/admin-layout.tsx`: The root `div` had no `dir="rtl"` attribute. The sidebar was on the left side (LTR layout) and nav links had LTR flex direction. **Fixed: added `dir="rtl"` to root container, changed border/shadow from `border-r` to `border-l`, added `flex-row-reverse` to all nav links and user profile section for proper Arabic RTL layout.**

52. **🟠 Admin sidebar active state didn't detect sub-routes** — `client/src/components/layout/admin-layout.tsx`: Active detection used strict equality `location === item.href`. Navigating to `/admin/deposits` would NOT highlight the "طلبات الإيداع" nav item. **Fixed: added `|| (item.href !== '/' && location.startsWith(item.href))` for sub-route detection (same pattern as store-layout).**

53. **🟠 Admin sidebar user info section showed `user.role` (English enum)** — `client/src/components/layout/admin-layout.tsx`: The user role display showed raw enum value `"ADMIN"` (English). **Fixed: replaced with Arabic "مدير النظام".**

54. **🟠 Notification bell routing fixes** — `client/src/components/ui/notification-bell.tsx`: `NEW_ORDER` for STORE_OWNER pointed to `/customer/store/orders` (wrong path); admin `WALLET_UPDATE`/`DEPOSIT`/`WITHDRAWAL` pointed to generic `/wallet`. **Fixed: STORE_OWNER order notifications → `/store/dashboard/orders`; admin wallet notifications → `/admin/finance`.**

55. **🟠 TypeScript error in `ledger.controller.ts`** — `server/modules/ledger/ledger.controller.ts`: `req.query.type` typed as `string | string[]` was passed directly to a function expecting `string`. **Fixed: cast to `string`.**

56. **🔴 `heldFunds` inflated by pending deposits** — `server/modules/ledger/ledger.service.ts`: The held funds query summed ALL pending wallet transactions including DEPOSIT type. Pending deposits are money waiting to come IN (not yet approved) so they should NOT reduce the available balance. **Fixed: added `eq(walletTransactions.type, "WITHDRAWAL")` filter so only pending withdrawal requests (funds already deducted but pending admin approval) count as held.**

57. **🔴 Deleting a store deleted the store owner's user account** — `server/storage.ts`: `deleteStore()` also deleted the owner's wallet, wallet transactions, ratings, audit logs, and the user account itself — a catastrophic unintended side effect. An admin deleting a store should not destroy the person who owns it. **Fixed: removed all owner-related deletions. Now only store-specific data is removed (products, sub-orders, order items, delivery offers, OTPs, and the store record itself).**

58. **🔴 `GET /api/stores` was fully unauthenticated** — `server/routes.ts`: The internal stores list endpoint had no middleware at all — any anonymous user could enumerate all stores and see owner IDs. The public equivalent `/api/public/stores` is intentionally open. **Fixed: added `authenticate, authorizeRole(["ADMIN", "STORE_OWNER"])` so only authenticated store owners and admins can access it.**

59. **🟠 401 response cleared token but didn't redirect to login** — `client/src/lib/api.ts`: When the backend returned a 401 (expired/invalid token), the JWT was removed from localStorage but the user stayed on the same page in a broken state (empty data, infinite loaders) until a manual page refresh. **Fixed: added `window.location.href = "/login"` redirect on 401, guarded to avoid redirect loops when already on the login page.**

60. **🟠 Ledger `REFUND` type missing — refunds stored as `DEPOSIT`** — `shared/schema.ts` and all refund ledger insertions: The ledger type enum only allowed `["DEPOSIT", "WITHDRAWAL", "COMMISSION"]`. All refunds (order cancellations, sub-order cancellations, withdrawal rejections) were recorded as `"DEPOSIT"` making them indistinguishable from actual deposits in financial audit trails. **Fixed: added `"REFUND"` to the ledger type enum in schema.ts and updated all four refund ledger insertions (`order.service.ts`, `suborder.service.ts`, `wallet.service.ts`, `routes.ts`) to use `type: "REFUND"`. Also updated `ledger.controller.ts` query schema and `transactionWrapper.ts` type union.**

61. **🔴 `approveDeposit` audit log recorded customer as the approver** — `server/modules/wallet/wallet.service.ts`: The `approveDeposit()` method had no `adminId` parameter. The audit entry used `performedByUserId: user?.id || wallet.userId` — but `user` is the CUSTOMER (fetched by `wallet.userId`), not the admin who clicked "approve". Every deposit approval appeared in the audit trail as if the customer approved their own deposit. **Fixed: added optional `adminId` parameter to `approveDeposit()`; audit log now uses `adminId` (the actual admin) as `performedByUserId` and `"ADMIN"` as `performedByRole`; updated `deposits.controller.ts` to extract `req.user.id` and pass it through.**

62. **🟠 Dead `depositService` import in `deposits.controller.ts`** — `server/modules/deposits/deposits.controller.ts`: The file imported `depositService` from `./deposits.service` (which operates on the separate `deposits` DB table) but never called it anywhere — all actual deposit operations use `walletService` (operating on `walletTransactions`). The unused import caused confusion about which service manages deposits. **Fixed: removed the dead import.**

63. **🔴 `notification.service.ts` used wrong `auditService` with hardcoded invalid UUID** — `server/modules/notifications/notification.service.ts`: Was importing `auditService` from `../audit/audit.service` (a different class with `insertAuditLog()` method) instead of the shared `../../services/auditService` (used everywhere else). The `audit/audit.service.ts` version contains a hardcoded fallback `performedByUserId: "00000000-0000-0000-0000-000000000000"` which would trigger a foreign key constraint violation since `audit_logs.performed_by_user_id` is NOT NULL and references `users.id`. **Fixed: switched to the shared `auditService` from `services/auditService.ts` using `logEvent()` method with proper `performedByUserId` and `performedByRole` fields.**

64. **🔴 Admin finance page always showed empty ledger** — `client/src/pages/admin/finance.tsx`: The `LedgerResponse` interface had `data: LedgerEntry[]` but the `/api/ledger/transactions` endpoint returns `{ transactions: [...], total, limit, offset, heldFunds }` not `{ data: [...] }`. So `data?.data ?? []` was always `undefined`, meaning the finance page always rendered "لا توجد معاملات مالية بعد." even when the platform had hundreds of transactions. **Fixed: updated `LedgerResponse` interface to `transactions: LedgerEntry[]` and `heldFunds: string`; changed `data?.data ?? []` to `data?.transactions ?? []`.**

65. **🟠 Customer transactions page order ID column always showed "—"** — `client/src/pages/customer/transactions.tsx`: The `Transaction` type had a `referenceId?: string` field, and the table rendered `{t_row.referenceId || "-"}`. But the `/api/ledger/transactions` endpoint returns `related_order_id` (not `referenceId`) — the ledger service explicitly maps `ledger.referenceId` → `related_order_id`. So `t_row.referenceId` was always `undefined` and every row showed "—" in the order ID column. **Fixed: renamed field to `related_order_id` in the type definition and updated the render to show the truncated order ID.**

## Bug Audit Round 10 (April 2026)

### Bugs Fixed

66. **🔴 Store images never displayed on the customer home page** — `server/modules/public/public.controller.ts` + `client/src/components/home/StoreCard.tsx`: `getStores()` mapped the DB `imageUrl` column to a `logoUrl` field in the API response. A previous fix (bug #28) had changed `StoreCard.tsx` from `store.logoUrl` to `store.imageUrl`, but the public API response was never updated. So `store.imageUrl` was always `undefined` when loading stores on the home page and the store image placeholder was shown for every store. **Fixed: `getStores()` now returns both `imageUrl` (matching the DB column) and `logoUrl` (kept for backward compatibility) so `StoreCard.tsx` renders images correctly.**

67. **🔴 `isCredit()` in driver wallet always returns false — all transactions display as debits** — `client/src/pages/driver/wallet.tsx`: The function checked `tx.creditUserId` (camelCase) but the `/api/ledger/transactions` endpoint returns `credit_user_id` (snake_case, as explicitly aliased in `ledger.service.ts`). Since `tx.creditUserId` was always `undefined`, every single ledger entry — including driver commissions and deposits — showed as a debit (red, down-arrow icon). **Fixed: updated `isCredit()` to check both `tx.credit_user_id` (snake_case) and `tx.creditUserId` (camelCase) for compatibility.**

68. **🟠 Driver wallet transaction amounts displayed without currency symbol** — `client/src/pages/driver/wallet.tsx`: The amount display was `{credit ? "+" : "-"}{parseFloat(tx.amount).toFixed(2)}` — no `ج.م` currency suffix. **Fixed: added ` ج.م` after the amount.**

69. **🟠 `getStore()` publicly exposes `ownerId` to anonymous users** — `server/modules/public/public.controller.ts`: The single store endpoint at `/api/public/stores/:id` included `ownerId: stores.ownerId` in the Drizzle select, returning the internal UUID of the store owner to unauthenticated visitors. **Fixed: removed `ownerId` from the select query so only public-safe fields are returned.**

70. **🟠 Admin orders page shows raw English enum values for all status columns** — `client/src/pages/admin/orders.tsx`: `overallStatus`, `deliveryStatus`, and `paymentStatus` were rendered directly as `{order.overallStatus}` etc. — displaying English enum strings like "PENDING", "IN_TRANSIT", "PAID" to Arabic-speaking admins. **Fixed: added three Arabic label maps (`ORDER_STATUS_LABELS`, `DELIVERY_STATUS_LABELS`, `PAYMENT_STATUS_LABELS`) and replaced all raw renders with translated labels.**

71. **🟠 Admin orders page date format in English ("Apr 9, 03:21 AM")** — `client/src/pages/admin/orders.tsx`: Used `format(new Date(order.createdAt), "MMM d, HH:mm a")` producing English month names. **Fixed: replaced with `toLocaleDateString("ar-EG")` producing Arabic numeric date format.**

72. **🟠 Admin users page shows raw English role enums** — `client/src/pages/admin/users.tsx`: Rendered `{user.role}` directly, showing "STORE_OWNER", "DRIVER", "CUSTOMER" in English. **Fixed: added `ROLE_LABELS` map translating all roles to Arabic: مشرف / صاحب متجر / سائق / عميل.**

73. **🟠 Admin users page date format in English** — `client/src/pages/admin/users.tsx`: Used `format(new Date(user.createdAt), "MMM d, yyyy")` producing English. **Fixed: replaced with `toLocaleDateString("ar-EG")` Arabic locale.**

74. **🟠 Admin dashboard ledger widget shows raw English type and status** — `client/src/pages/admin/dashboard.tsx`: Recent financial activity showed `{tx.type}` ("DEPOSIT", "COMMISSION") and `{tx.status}` ("COMPLETED") in English. **Fixed: added inline Arabic label maps for both type and status.**

75. **🟠 Admin dashboard recent orders show raw English overallStatus** — `client/src/pages/admin/dashboard.tsx`: `{order.overallStatus}` rendered "PENDING", "DELIVERED" etc. in the order table. **Fixed: added inline `orderStatusLabels` map and replaced raw render with translated label.**

76. **🟠 Driver earnings page date format in English** — `client/src/pages/driver/earnings.tsx`: `format(date, "MMM dd, yyyy HH:mm")` → English month names. **Fixed: replaced with Arabic locale `toLocaleDateString("ar-EG")`.**

77. **🟠 Driver earnings page transaction status badge shows raw "COMPLETED"** — `client/src/pages/driver/earnings.tsx`: The `{tx.status}` badge showed raw English enum. **Fixed: translated to Arabic: "مكتمل" / "قيد المعالجة" / "فشل".**

78. **🟠 Customer wallet page pending deposit date format in English** — `client/src/pages/customer/wallet.tsx`: `format(date, "MMM d, yyyy HH:mm")` → English. **Fixed: replaced with `toLocaleDateString("ar-EG")`.**

79. **🟠 Customer wallet pending deposit status badge shows raw English** — `client/src/pages/customer/wallet.tsx`: Badge showed `{d.transaction.status}` ("PENDING", "COMPLETED") in English. **Fixed: translated to Arabic.**

80. **🟠 Customer wallet transaction history status badge shows raw "COMPLETED"** — `client/src/pages/customer/wallet.tsx`: `{tx.status}` in the transaction history table badge showed English. **Fixed: translated to Arabic.**

81. **🟠 Customer wallet transaction history date format in English** — `client/src/pages/customer/wallet.tsx`: `format(date, "MMM d, yyyy HH:mm")` → English. **Fixed: replaced with Arabic locale.**

82. **🟠 Admin finance page date format in English** — `client/src/pages/admin/finance.tsx`: `format(date, "dd MMM yyyy، HH:mm")` produced English month names despite using an Arabic comma. **Fixed: replaced with `toLocaleDateString("ar-EG")` + `toLocaleTimeString("ar-EG")`.**

83. **🟠 Admin approvals page date format in English** — `client/src/pages/admin/approvals.tsx`: `format(date, "dd MMM yyyy")` → English month names. **Fixed: replaced with Arabic locale.**

84. **🟠 Store owner orders page date format in English** — `client/src/pages/customer/store/orders.tsx`: `format(sub.createdAt, "MMM d, HH:mm")` → English. **Fixed: replaced with Arabic locale `toLocaleString("ar-EG")`.**

85. **🟠 Store owner earnings page date format in English** — `client/src/pages/customer/store/earnings.tsx`: `format(date, "MMM dd, yyyy HH:mm")` → English. **Fixed: replaced with Arabic locale.**

86. **🟠 Store order detail page date format in English** — `client/src/pages/customer/store/order/[id].tsx`: `format(date, "MMM dd, yyyy HH:mm")` → English. **Fixed: replaced with Arabic locale.**

87. **🟠 Customer transactions page date format in English** — `client/src/pages/customer/transactions.tsx`: `format(date, "MMM dd, yyyy HH:mm")` → English. **Fixed: replaced with Arabic locale.**

88. **🔴 TypeScript TS2345 in `audit.tsx` — `formatArabicDateTime` received `Date` not `string`** — `client/src/pages/admin/audit.tsx`: Function signature declared `dateStr: string` but `AuditLog.createdAt` from Drizzle is typed as `Date`. **Fixed: changed param type to `string | Date` with safe `typeof` branch.**

89. **🔴 TypeScript TS2345 in `users.tsx` — `formatArabicDate` received `Date` not `string`** — `client/src/pages/admin/users.tsx`: Same issue — `User.createdAt` is `Date` from Drizzle, but function accepted only `string`. **Fixed: changed param type to `string | Date` with safe `typeof` branch.**

90. **🔴 `tsconfig.json` excluded `*.test.ts` but not `*.test.tsx` or `*.spec.ts`** — Test files (`inventory.test.tsx`, `audit.spec.ts`, etc.) were included in main compilation, causing cascading errors from missing `@types/jest` and `@testing-library/react`. **Fixed: added `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx` to the `exclude` array.**

91. **🟠 `audit.spec.ts` used `sql` from `drizzle-orm` without importing it** — Line 31 called `sql\`${auditLogs.createdAt} DESC\`` inside `orderBy` but `sql` was not imported, causing a `ReferenceError` at runtime. **Fixed: added `sql` to the `drizzle-orm` import.**

92. **🔴 No "reject" action on Approvals page** — Admin could only approve STORE_OWNER/DRIVER applicants. There was no way to reject an unsuitable applicant without directly deleting from DB. **Fixed: added `DELETE /api/admin/users/:id` backend endpoint (protected: only unapproved STORE_OWNER/DRIVER, deletes store + wallet in a transaction) + `useRejectUser` hook + reject button with confirmation dialog on `admin/approvals.tsx`.**

93. **🟠 Approvals page showed no role-specific details** — Transport type for drivers and store name for STORE_OWNER were missing from the approval list, forcing admin to look up each applicant manually. **Fixed: `approvals.tsx` now fetches stores via `useStores`, joins them client-side to show store name for STORE_OWNER rows, and shows Arabic transport type label for DRIVER rows.**

94. **🟠 Dead code: `notification.emitter.ts` + emitter listener in `notification.service.ts`** — `NotificationService` subscribed to a `notificationEmitter` that was never triggered from anywhere in the codebase. The real notification system uses `push.service.ts` directly. **Fixed: removed the emitter listener from `notification.service.ts`, deleted the orphaned `notification.emitter.ts` file entirely.**

95. **🔴 `support_messages` table missing from bootstrap** — `server/bootstrap/db-auto-verify.ts`: The `supportMessages` table is defined in `shared/schema.ts` and used by the support chat feature, but was never included in the auto-verification bootstrap. On a fresh PostgreSQL database, any attempt to send or receive a support message would fail with `relation 'support_messages' does not exist`. **Fixed: added the `support_messages` table definition to `db-auto-verify.ts`; confirmed creation on next startup (`Created ⚠️` in the verification report).**

96. **🟠 `getActiveDeliveryForDriver` returns expired/verified OTPs** — `server/modules/orders/suborder.service.ts`: The query to fetch the OTP for a driver's active delivery had no filter on OTP status or expiry. A driver could see `hasOtp: true` even after the OTP was verified or expired, misleading the frontend into showing an OTP prompt when no valid OTP existed. **Fixed: added `eq(deliveryOtps.status, "PENDING")` and `gt(deliveryOtps.expiresAt, now)` to the OTP query so only live, unexpired OTPs are returned.**

97. **🟠 Customer wallet transaction filter shows COMMISSION, hides REFUND** — `client/src/pages/customer/wallet.tsx`: After bug #60 added `"REFUND"` as a proper ledger type (replacing the misuse of `"DEPOSIT"` for refunds), the wallet filter was never updated to reflect this. The filter showed `COMMISSION` (a type customers never receive — those go to store owners and drivers) and omitted `REFUND` (which customers do receive on order cancellations). Customers could not filter their refund history. **Fixed: replaced `COMMISSION` with `REFUND` in the filter `SelectItem`. Also fixed the amount sign/color: `REFUND` is a credit to the customer so it now shows green with `+`, not red with `-`.**

98. **🟠 `seedDatabase()` called without `await` in `registerRoutes`** — `server/routes.ts`: The `seedDatabase()` function was invoked without `await`, meaning `registerRoutes()` returned and the server began accepting requests before seed data was committed. Any early request in development that depended on seeded users/stores could fail with a 404 or empty result. **Fixed: added `await` so the seed completes before the server is ready.**

## Bug Audit Round 11 (April 2026)

### Bugs Fixed

99. **🔴 Admin finance page `LedgerEntry` interface used camelCase field names** — `client/src/pages/admin/finance.tsx`: The `LedgerEntry` interface declared `referenceId: string | null`, `debitUserId: string | null`, `creditUserId: string | null`. But `ledger.service.ts` explicitly aliases these columns to snake_case in SELECT: `related_order_id`, `debit_user_id`, `credit_user_id`, `user_id`. So `entry.referenceId` was always `undefined`, causing every "مرجع" cell in the admin finance transactions table to display "—" even when a real order reference existed. Same root cause as bugs #39, #42, and #65. **Fixed: updated `LedgerEntry` interface to match the actual snake_case API response field names (`related_order_id`, `debit_user_id`, `credit_user_id`, `user_id`) and updated the table cell template to use `entry.related_order_id`.**

100. **🟡 Customer transactions page offered `COMMISSION` filter — irrelevant for customers** — `client/src/pages/customer/transactions.tsx`: The type filter dropdown included `<SelectItem value="COMMISSION">`. Customers never receive COMMISSION ledger entries (those go exclusively to store owners and drivers). Selecting this filter always returned an empty list, misleading users into thinking their earnings data was missing. **Fixed: removed the COMMISSION SelectItem, keeping only DEPOSIT, WITHDRAWAL, and REFUND which are the transaction types a customer can actually have.**

## Bug Audit Round 12 (April 2026)

### Bugs Fixed

101. **🟠 `auditMiddleware` added overhead to every HTTP request with zero benefit** — `server/routes.ts` + `server/modules/audit/audit.middleware.ts`: `auditMiddleware` was registered globally via `app.use(auditMiddleware)`. The middleware patches `res.send` on every single HTTP request, but only logs if `req.audit` is set — and `req.audit` is **never set** anywhere in the codebase. The middleware intercepted every request (including `GET /api/health` every 30 seconds) with a `res.send` wrapper that always did nothing. Real audit logging is done via direct `auditService.logEvent()` calls in each module. **Fixed: removed `app.use(auditMiddleware)` from `server/routes.ts` and removed the import. Overhead eliminated. Actual audit logging continues to work correctly via direct service calls.**

102. **🟠 Withdrawal approval/rejection sent push notification only — no email** — `server/modules/wallet/wallet.service.ts` + `server/modules/notifications/notification.service.ts`: The deposit lifecycle sends emails in all three states (submitted/approved/rejected via `notifyDepositSubmitted/Approved/Rejected()`). The withdrawal lifecycle sent only a push notification on approval and only a push notification on rejection — no email in either case. For drivers and store owners waiting on significant withdrawal amounts, a push notification can easily be missed. **Fixed: added `notifyWithdrawalApproved()` and `notifyWithdrawalRejected()` email methods to `NotificationService`. Updated `approveWithdrawal()` and `rejectWithdrawal()` in `wallet.service.ts` to capture user email inside the DB transaction then send email after the transaction commits (pattern mirrors `approveDeposit` — email is fire-and-forget and cannot roll back the financial operation).**
