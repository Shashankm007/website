# Backend service contracts (cross-module API)

> Authoritative signatures for **exported** services. Providers MUST implement these
> exactly; consumers call them exactly. Each feature module is self-contained: it owns
> its public endpoints, its admin-guarded endpoints (`/admin/...`), its DTOs, and its service.
> Money is always integer paise. All services inject `PrismaService`.

## Global building blocks (already implemented — import, don't recreate)
- `PrismaService` (`src/prisma/prisma.service.ts`) — DB gateway, globally available.
- `MailService` (`src/mail/mail.service.ts`) — `sendOrderConfirmation`, `sendOrderStatusUpdate`, etc. Global.
- `AuditService` (`src/audit/audit.service.ts`) — `log({ actorId, action, entity, entityId, metadata, ip })`. Global.
- `CacheService` (`src/redis/cache.service.ts`) — `get/set/del/wrap`. Global.
- Guards/decorators (`src/common/...`): `JwtAuthGuard` (global), `RolesGuard` (global),
  `@Public()`, `@Roles(Role.ADMIN)`, `@CurrentUser()`, `@Raw()`, `OptionalJwtAuthGuard`.
- `paginate(items, total, page, limit)` + `Paginated<T>` from `src/common/interfaces/api-response.interface.ts`.
- `PaginationQueryDto` from `src/common/dto/pagination.dto.ts`.
- `slugify`, `sanitizePlain`, `sanitizeRichText`, `formatMoney` from `src/common/utils/...`.

## UsersService (UsersModule) — exports UsersService
- `getProfile(userId: string)` → user (no passwordHash) + addresses
- `updateProfile(userId, dto)` → updated public user
- `listAddresses(userId)` / `addAddress(userId, dto)` / `updateAddress(userId, id, dto)` / `deleteAddress(userId, id)` / `setDefaultAddress(userId, id)`
- `getAddressForUser(userId, id)` → Address | throws (used by OrdersService to validate ownership)
- Admin: `adminList(query)` → `Paginated<user>`, `adminFindById(id)`, `adminSetStatus(id, status: UserStatus)`, `adminSetRole(id, role: Role)`

## ProductsService (ProductsModule) — exports ProductsService
- `findAll(query: ProductQueryDto)` → `Paginated<productCard>` (only ACTIVE; supports search/filter/sort per CONVENTIONS §7)
- `findBySlug(slug)` → full detail (media, options+values, categories, tags, inventory, ratingAvg) + `related[]`
- `findById(id)` → product
- Admin: `adminList(query)` → `Paginated` incl DRAFT/ARCHIVED; `create(dto: CreateProductDto)`; `update(id, dto: UpdateProductDto)`; `remove(id)`; `addMedia(id, items)`; `removeMedia(mediaId)`; `bulkImport(rows)` (CSV)
- `incrementSales(productId, qty)` (called by OrdersService.markPaid)
- Recompute of `ratingAvg/ratingCount` is owned by ReviewsService (updates the product row directly).

## CategoriesService (CategoriesModule) — exports CategoriesService
- `findTree()` → nested categories; `findBySlug(slug)`; `findById(id)`
- Admin: `create(dto)`, `update(id, dto)`, `remove(id)`

## CartService (CartModule) — exports CartService
Cart context: `{ userId?: string; guestToken?: string }` (controller derives from `@CurrentUser()` or `x-cart-token` header).
- `getCart(ctx)` → `CartView { id, token?, items: CartItemView[], subtotalCents, itemCount }` where each item has resolved `unitPriceCents`, product summary, options, image.
- `addItem(ctx, dto)`, `updateItem(ctx, itemId, dto)`, `removeItem(ctx, itemId)`, `clear(ctx)`
- `mergeGuestIntoUser(userId, guestToken)` → merges then deletes guest cart (call on login)
- `getCheckoutCart(userId)` → `{ items: [{ product, variantId?, quantity, unitPriceCents, optionsJson, customText }], subtotalCents }` (throws if empty) — used by OrdersService
- `clearForUser(userId)` (called by OrdersService.markPaid)
- Unit price = product.priceCents + sum(selected option value priceDeltaCents) (+ variant price if variantId).

## CouponsService (CouponsModule) — exports CouponsService
- `validateAndPrice(code, subtotalCents, userId?)` → `{ coupon, discountCents }` or throws BadRequest (expired/min/max/usage)
- `redeem(couponId)` → increments `redemptions` (call inside the order transaction)
- Admin: `list(query)`, `create(dto)`, `update(id, dto)`, `remove(id)`

## InventoryService (InventoryModule) — exports InventoryService
- `getLevel(productId)` → Inventory | null
- `adjust(productId, delta, reason: InventoryReason, opts?: { orderId?, note?, actorId? })` → updates Inventory.quantity + writes InventoryLedger (atomic). Throws if it would go negative on a STOCKED product.
- `assertAvailable(items: {productId, quantity}[])` → throws if a STOCKED product lacks stock; MADE_TO_ORDER always passes
- `commitForOrder(items: {productId, quantity}[], orderId, tx?)` → decrement stock + ledger reason ORDER (skips MADE_TO_ORDER)
- `restockForOrder(items, orderId, reason: InventoryReason)` → increment back (cancellation/return)
- `listLow()` → products at/under threshold
- Admin endpoints: `GET /admin/inventory`, `GET /admin/inventory/low`, `POST /admin/inventory/:productId/adjust`

## OrdersService (OrdersModule) — exports OrdersService. Imports CartModule, CouponsModule, InventoryModule.
- `createFromCart(userId, dto: CreateOrderDto)` → Order(PENDING). Steps in one `prisma.$transaction`:
  1. `cart = CartService.getCheckoutCart(userId)`; 2. validate `InventoryService.assertAvailable`;
  3. compute subtotal, `discountCents` via `CouponsService.validateAndPrice` (optional), `shippingCents` (flat: ₹79 = 7900, free over ₹999 = 99900), `taxCents` (GST 18% of taxable = round(subtotal-discount)*0.18);
  4. snapshot address (`UsersService.getAddressForUser`) into `shippingSnapshot`; 5. create Order + OrderItems (immutable snapshots) + Payment(REQUIRES_PAYMENT) + OrderEvent(PENDING);
  6. generate `orderNumber` `HTC-<year>-<zero-padded counter>` (use a `Setting` counter row in the tx).
  Reservation: increment `Inventory.reserved` for STOCKED items (don't decrement quantity yet).
- `listForUser(userId, query)` → `Paginated<order>`; `getForUser(userId, id)` (404 if not owner)
- `cancel(userId, id)` → only if PENDING; release reservation; status CANCELLED + event
- `markPaid(orderId, { razorpayOrderId, razorpayPaymentId, receiptUrl?, amountCents })` → idempotent: set PAID+paidAt, Payment SUCCEEDED, `InventoryService.commitForOrder` (also clears the reservation), `ProductsService.incrementSales`, `CartService.clearForUser`, `MailService.sendOrderConfirmation`, OrderEvent. **Idempotent** (no-op if already PAID).
- `markPaymentFailed(orderId, reason)` → Payment FAILED + event (order stays PENDING)
- `generateInvoicePdf(orderId, requester: AuthUser)` → `Buffer` (pdfkit). Requester must own the order or be ADMIN.
- Admin: `adminList(query)`, `adminGetById(id)`, `updateStatus(id, dto: UpdateOrderStatusDto, actor)` → set status (+ tracking/carrier), timestamps, OrderEvent, send `MailService.sendOrderStatusUpdate`; if CANCELLED/REFUNDED restock via InventoryService.

## PaymentsService (PaymentsModule) — exports PaymentsService. Imports OrdersModule.
- `createOrder(userId, orderId)` → verifies order belongs to user & is PENDING; creates/reuses a Razorpay Order for `order.totalCents` with `notes.orderId`; upserts Payment.razorpayOrderId; returns `{ keyId, razorpayOrderId, amount, currency, orderNumber }`
- `verify(userId, { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature })` → verifies the Razorpay HMAC signature (`razorpayOrderId|razorpayPaymentId` with `RAZORPAY_KEY_SECRET`); on success → `OrdersService.markPaid`. Returns the updated order.
- `handleWebhook(rawBody: Buffer, signature: string)` → verifies the Razorpay HMAC from the `x-razorpay-signature` header with `RAZORPAY_WEBHOOK_SECRET`; on `payment.captured` → `OrdersService.markPaid`; on `payment.failed` → `OrdersService.markPaymentFailed`; on `refund.processed` → mark order REFUNDED. Returns `{ received: true }`.
- Endpoints: `POST /payments/create-order` (auth), `POST /payments/verify` (auth), `POST /payments/webhook` (`@Public()` + `@Raw()`, reads `req.rawBody`).

## ReviewsService (ReviewsModule) — exports ReviewsService
- `listForProduct(productId, query)` → `Paginated<review>` (approved only for public)
- `create(userId, dto: CreateReviewDto)` → one per (user,product); `verified=true` if user has a DELIVERED order containing the product; then recompute `product.ratingAvg/ratingCount`
- `update(userId, id, dto)` (owner); `remove(user: AuthUser, id)` (owner or ADMIN); both recompute aggregate
- Endpoints: `GET /products/:productId/reviews` (public), `POST /reviews` (auth), `PATCH/DELETE /reviews/:id`

## UploadsService (UploadsModule) — exports UploadsService
- `presignPut(dto: { fileName, contentType, kind: 'image'|'model'|'custom' })` → `{ uploadUrl, objectKey, publicUrl }` (S3 presigned PUT, 5-min expiry; validates content type/size by kind)
- `recordCustomUpload(userId, { fileName, objectKey, sizeBytes })` → CustomUpload row
- `publicUrl(objectKey)` → `${S3_PUBLIC_URL}/${objectKey}`
- Endpoints: `POST /uploads/presign` (auth), `POST /uploads/custom` (auth)

## AdminModule (`/admin`) — RBAC ADMIN. Reads via PrismaService directly (aggregates).
- `GET /admin/overview` → `{ revenueCents, orderCount, paidOrderCount, userCount, lowStockCount, recentOrders[], topProducts[] }`
- `GET /admin/analytics?range=7d|30d|90d` → `{ salesByDay: [{date, revenueCents, orders}], ordersByStatus, newUsersByDay }`
- `GET /admin/audit-logs` → `Paginated<auditLog>` (filter by entity/actor)
- Overview/analytics revenue counts only orders with status in (PAID, PRINTING, SHIPPED, DELIVERED).
