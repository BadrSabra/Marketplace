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
