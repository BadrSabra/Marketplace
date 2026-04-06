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
| CUSTOMER | `/` | `/customer/wallet`, `/customer/order/:id` |

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
