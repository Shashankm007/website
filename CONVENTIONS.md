# Engineering Conventions — HashTag Creations

> This is the **single source of truth / contract** for the codebase. Every backend module
> and frontend page is built against these conventions. Read this before writing any code.

## 1. Project layout

```
website/
├── backend/        NestJS REST API (owns auth, business logic, DB, payments)
├── frontend/       Next.js (App Router) storefront + admin UI (consumes the API)
├── docker-compose.yml
├── .env.example    Root env used by docker-compose
├── README.md
└── CONVENTIONS.md  (this file)
```

The two apps are **fully decoupled**. They communicate only over HTTP/JSON. The frontend
never imports backend code. Shared shapes are duplicated as TS types on the frontend
(`frontend/src/types`).

## 2. API surface

- Base URL: `${API_URL}` (e.g. `http://localhost:4000`). All routes are prefixed with `/api/v1`.
- Auth routes: `/api/v1/auth/*`
- Public catalog: `/api/v1/products`, `/api/v1/categories`, `/api/v1/reviews`
- Authenticated user: `/api/v1/cart`, `/api/v1/orders`, `/api/v1/users/me`, `/api/v1/wishlist`
- Admin: `/api/v1/admin/*` (RBAC: `ADMIN` only)
- Payments: `/api/v1/payments/*` (+ raw webhook at `/api/v1/payments/webhook`)
- Uploads: `/api/v1/uploads/*` (presigned S3 URLs)
- Health: `/api/v1/health`

Swagger/OpenAPI docs are served at `/api/docs`.

## 3. Response envelope

**Success** responses are wrapped by a global interceptor:

```json
{ "success": true, "data": <payload>, "meta": { ...optional pagination } }
```

Paginated list payloads use `meta`:

```json
{ "success": true, "data": [ ...items ], "meta": { "page": 1, "limit": 20, "total": 137, "totalPages": 7 } }
```

**Errors** are produced by the global exception filter:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [ ... ], "statusCode": 400 }, "path": "/api/v1/...", "timestamp": "ISO" }
```

Error `code` values: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `RATE_LIMITED`, `PAYMENT_ERROR`, `INTERNAL_ERROR`.

## 4. Auth flow

- **Access token**: JWT, ~15 min TTL, sent as `Authorization: Bearer <token>`.
- **Refresh token**: opaque-ish JWT, ~7 day TTL, stored **hashed** in DB (`RefreshToken` table),
  delivered as an **httpOnly, Secure, SameSite=Lax cookie** named `refresh_token`. Rotated on every refresh.
- `POST /auth/register` → creates user (`emailVerified=null`), sends verification email.
- `POST /auth/login` → returns `{ accessToken, user }` + sets refresh cookie.
- `POST /auth/refresh` → reads refresh cookie, rotates it, returns new `{ accessToken }`.
- `POST /auth/logout` → revokes refresh token, clears cookie.
- `POST /auth/verify-email` `{ token }`, `POST /auth/forgot-password` `{ email }`,
  `POST /auth/reset-password` `{ token, password }`.
- `GET /auth/google` / `GET /auth/google/callback` → optional OAuth.
- Auth endpoints are **rate limited** (stricter than global throttle).

## 5. RBAC

Roles (enum `Role`): `CUSTOMER`, `ADMIN`. (Guests = no token.)
- Every protected route uses `JwtAuthGuard`. Public routes are marked `@Public()`.
- Admin routes additionally use `RolesGuard` + `@Roles(Role.ADMIN)`.
- `@CurrentUser()` decorator injects the authenticated user (`{ id, email, role }`).
- Blocked users (`status=BLOCKED`) are rejected at the guard with `403 FORBIDDEN`.
- All admin mutations are written to `AuditLog`.

## 6. Validation & security

- Backend: global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
  DTOs use `class-validator` + `class-transformer`. All user text sanitized for XSS on output via the
  frontend; rich text fields sanitized server-side too.
- `helmet`, CORS locked to `FRONTEND_URL` with credentials, global rate limiting (`@nestjs/throttler`),
  cookie-parser, CSRF mitigated via SameSite cookies + bearer access tokens (no auth state in
  ambient cookies except the refresh token which is path-scoped to `/api/v1/auth`).
- Prisma parameterizes all queries (no raw SQL except explicitly-reviewed `$queryRaw` with tagged templates).
- Secrets only via env. Never commit `.env`.

## 7. Pagination / filtering / sorting (catalog)

Query params on `GET /products`:
`page`, `limit` (max 100), `search` (full-text on name+description), `categoryId`/`categorySlug`,
`tags` (csv), `minPrice`, `maxPrice`, `availability` (`in_stock|made_to_order|all`),
`sort` (`price_asc|price_desc|newest|popular|rating`).

## 8. Money & types

- Money stored as **integer minor units** (paise) in DB (`Int`) to avoid float errors;
  API exposes both `priceCents` and a formatted `price` string. Currency default `INR`.
- IDs are CUIDs (Prisma `@default(cuid())`).
- Timestamps: every table has `createdAt` / `updatedAt`.

## 9. Naming

- Backend: NestJS modules `feature.module.ts`, `feature.controller.ts`, `feature.service.ts`,
  `dto/*.dto.ts`, `entities/*.entity.ts` (swagger response shapes).
- Frontend: App Router under `src/app`, components `PascalCase.tsx`, hooks `useX.ts`,
  server data fetching via `src/lib/api.ts`.
- HTTP status: 200/201 success, 204 no content, 400/401/403/404/409/422/429 client, 500 server.

## 10. 3D / uploads

- Product 3D previews: STL/OBJ rendered with `three` + `@react-three/fiber` + `@react-three/drei`.
- Customer custom-print uploads & admin product images/models go to S3 (or R2) via
  **presigned PUT** URLs requested from `/uploads/presign`. DB stores the object key + public URL.
