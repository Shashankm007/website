# 🛠️ HashTag Creations — Production E-commerce for 3D-Printed Products

A full-stack, production-grade store for selling 3D-printed products and made-to-order
custom prints. Built with **Next.js 14 (App Router)** + **NestJS** + **PostgreSQL/Prisma**,
with Razorpay payments, Shiprocket shipping/fulfilment, S3/R2 storage, JWT auth (rotating
refresh tokens), RBAC, an admin dashboard, a 3D STL/OBJ viewer, and Docker deployment.

> 📖 **Full step-by-step run & deploy guide → [RUNNING.md](RUNNING.md)** (local setup, env vars, Razorpay, and production deployment).

---

## ✨ Features

**Storefront**
- Catalog with full-text-ish search, faceted filters (category, tags, price, availability), and sorting (price / newest / popularity / rating)
- Product detail with image gallery, **interactive 3D model preview (Three.js)**, customization options (size / material / color), custom engraving text, and reviews
- Cart (guest + authenticated, auto-merged on login), wishlist
- Multi-step checkout (shipping → payment → review) with **Razorpay** + webhooks
- Order history, status timeline, downloadable PDF invoices, resume-payment on pending orders
- Star-products **carousel** on the landing page, **RAG AI chat widget** + **WhatsApp** click-to-chat
- Email verification, password reset, Google OAuth (optional), profile + address book

**Admin**
- Dashboard metrics (revenue, orders, customers, low stock) + analytics charts
- Product / category / coupon CRUD, multi-image/video uploads (presigned S3), inline discounts, CSV bulk import
- Curated **star products** (landing carousel), site **announcement banner**, inventory ledger + low-stock alerts
- Order management (status updates, refunds), **Shiprocket** fulfilment (one-click ship → AWB + tracking link, status auto-synced via webhook), customer management (block / role)
- **Support chat inbox** (logged RAG-chatbot conversations, reindex KB), audit log of privileged actions

**Engineering**
- RBAC (Guest / Customer / Admin) enforced by global guards on every endpoint
- Security: bcrypt, JWT access + rotating hashed refresh tokens (httpOnly cookies), Helmet, CORS, rate limiting, class-validator DTOs, XSS sanitization, Prisma-parameterized queries
- Redis caching + throttler storage (optional, degrades gracefully)
- OpenAPI/Swagger docs, standard response envelope, centralized error handling
- Dockerized, `docker compose` one-command spin-up, CI workflow

---

## 🧱 Tech stack

| Layer        | Technology |
|--------------|-----------|
| Frontend     | Next.js 14, React 18, TypeScript, Tailwind CSS, Three.js (`@react-three/fiber`/`drei`), Razorpay, SWR, Zustand, Recharts |
| Backend      | NestJS 10, TypeScript, Prisma ORM, Passport (JWT + Google), Razorpay, Shiprocket, Nodemailer, AWS SDK v3 |
| AI chatbot   | RAG over a knowledge base — BM25 retrieval (offline) or neural embeddings + an open-source LLM (Ollama/Groq/…) via OpenAI-compatible API |
| Database     | PostgreSQL 16 |
| Cache/Queue  | Redis 7 (optional) |
| Storage      | AWS S3 or Cloudflare R2 / MinIO (presigned uploads) |
| Infra        | Docker, Docker Compose, GitHub Actions |

---

## 📂 Project structure

```
website/
├── backend/                  # NestJS REST API
│   ├── prisma/
│   │   ├── schema.prisma      # canonical data model (source of truth)
│   │   └── seed.ts            # demo data (admin, products, coupon)
│   ├── src/
│   │   ├── main.ts            # bootstrap: helmet, cors, validation, swagger
│   │   ├── app.module.ts      # wires modules + global guards
│   │   ├── common/            # guards, decorators, filters, interceptors, dto, utils
│   │   ├── config/            # typed config + env validation
│   │   ├── prisma/ redis/ mail/ audit/   # global infrastructure
│   │   ├── auth/              # register/login/refresh/verify/reset, Google OAuth
│   │   ├── users/ products/ categories/ cart/ wishlist/
│   │   ├── orders/ payments/ inventory/ reviews/ coupons/ uploads/
│   │   ├── admin/            # dashboard metrics + analytics + audit logs
│   │   └── health/
│   ├── Dockerfile · docker-entrypoint.sh
│   ├── SERVICE_CONTRACTS.md   # cross-module service signatures
│   └── .env.example
├── frontend/                 # Next.js storefront + admin UI
│   └── src/
│       ├── app/              # App Router pages (storefront, auth, account, admin)
│       ├── components/       # ui/ layout/ product/ cart/ checkout/ admin/ auth/
│       ├── lib/             # api clients, auth context, cart store, hooks, utils
│       └── types/          # API response types
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
├── .env.example              # root env consumed by docker-compose
├── CONVENTIONS.md            # the contract: API envelope, auth, RBAC, money rules
└── README.md
```

---

## 🚀 Quick start (Docker — recommended)

Requires Docker + Docker Compose.

```bash
git clone <repo> && cd website
cp .env.example .env
# Edit .env: set strong POSTGRES_PASSWORD, JWT secrets (openssl rand -base64 48),
# Razorpay keys, SMTP, and S3 creds.

docker compose up --build
```

Then:
- Storefront → http://localhost:3000
- API → http://localhost:4000/api/v1  ·  Swagger → http://localhost:4000/api/docs
- Migrations run automatically on backend start. To seed demo data, set `SEED_ON_START=true`
  in the backend service env (or run `docker compose exec backend npm run prisma:seed`).

Test accounts after seeding (sign in at `/login`):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@hashtagcreations.in` | `Admin123!` |
| Customer | `customer@hashtagcreations.in` | `Customer123!` |

---

## 🧑‍💻 Local development (without Docker)

You need Node 20+, a running PostgreSQL, and (optionally) Redis.

**Backend**
```bash
cd backend
cp .env.example .env          # point DATABASE_URL at your Postgres
npm install
npm run prisma:migrate        # create the schema (dev)
npm run prisma:seed           # demo data
npm run start:dev             # http://localhost:4000
```

**Frontend**
```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:3000
```

---

## 🗄️ Database

The schema lives in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) and covers
Users, Roles, Addresses, RefreshTokens, Categories (hierarchical), Products (+ media, options,
values, variants), Inventory (+ append-only ledger), Cart/CartItems, Wishlist, Orders/OrderItems/
OrderEvents, Payments, Reviews, Coupons, AuditLogs, and Settings. Money is stored as **integer
paise**; all tables have `createdAt`/`updatedAt` and are indexed for common access paths.

Useful commands (run in `backend/`):
```bash
npm run prisma:migrate     # dev migration
npm run prisma:deploy      # apply migrations in prod
npm run prisma:studio      # browse data
npm run db:reset           # drop + recreate + seed (dev only!)
```

---

## 🔌 API overview

Base path: `/api/v1`. Standard envelope: `{ success, data, meta? }` (errors:
`{ success:false, error:{ code, message, statusCode } }`). Full interactive docs at `/api/docs`.

| Area | Examples |
|------|----------|
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `POST /auth/verify-email` · `POST /auth/forgot-password` · `POST /auth/reset-password` · `GET /auth/google` |
| Catalog | `GET /products` (filters/sort/search) · `GET /products/:slug` · `GET /categories` |
| Cart | `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:id` · `DELETE /cart/items/:id` · `POST /cart/merge` |
| Orders | `POST /orders` · `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` · `GET /orders/:id/invoice` |
| Payments | `POST /payments/create-order` · `POST /payments/verify` · `POST /payments/webhook` |
| Reviews | `GET /products/:id/reviews` · `POST /reviews` |
| Uploads | `POST /uploads/presign` · `POST /uploads/custom` |
| Admin | `GET /admin/overview` · `GET /admin/analytics` · `/admin/products` · `/admin/orders` · `/admin/users` · `/admin/inventory` · `/admin/coupons` · `/admin/categories` |

See [`backend/SERVICE_CONTRACTS.md`](backend/SERVICE_CONTRACTS.md) for service-level method contracts.

---

## 💳 Razorpay setup

1. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (backend) and `NEXT_PUBLIC_RAZORPAY_KEY_ID` (frontend).
2. Configure a webhook to `POST {API_URL}/api/v1/payments/webhook` for events
   `payment.captured`, `payment.failed`, `refund.processed`.
3. Put the signing secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Razorpay supports UPI, cards, net banking & wallets. Test mode uses `rzp_test_` keys.

The webhook route reads the **raw request body** to verify the Razorpay HMAC signature from the
`x-razorpay-signature` header (enabled in `main.ts`).

> **Shipping is separate from payments.** Fulfilment runs on **Shiprocket** — admins ship an order
> in one click to get an AWB + customer tracking link, and a tracking webhook auto-syncs the order
> status (Shipped/Delivered). Set `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD` (+ pickup location and
> `SHIPROCKET_WEBHOOK_TOKEN`); full setup in [RUNNING.md](RUNNING.md). Without credentials the
> ship action returns a friendly "not configured" message.

---

## 🔐 Security highlights

- Passwords hashed with **bcrypt** (cost 12); access tokens are short-lived JWTs, refresh tokens
  are random, **hashed at rest**, rotated on use, and revoked on logout / password change / reuse.
- Refresh token in an **httpOnly, SameSite=Lax, path-scoped** cookie; access token kept in memory
  on the client (no `localStorage`), mitigating XSS token theft.
- **Helmet**, strict **CORS** (credentials, single origin), and **rate limiting** (stricter on auth).
- All input validated by **class-validator** DTOs (whitelist + forbid unknown). Rich text sanitized.
- Every protected route runs the global `JwtAuthGuard`; admin routes add `RolesGuard`. Admin actions
  are written to an **audit log**.

See [SECURITY.md](SECURITY.md) for the full checklist.

---

## ⚙️ Environment variables

See **[.env.example](.env.example)** (root, for Docker), **[backend/.env.example](backend/.env.example)**,
and **[frontend/.env.example](frontend/.env.example)**. Generate secrets with `openssl rand -base64 48`.
Never commit real `.env` files.

---

## 🧪 Tooling

```bash
# backend
npm run lint · npm run test · npm run build
# frontend
npm run lint · npm run typecheck · npm run build
```

CI (lint + typecheck + build for both apps) runs on every push — see `.github/workflows/ci.yml`.

---

## 📜 License

MIT.
