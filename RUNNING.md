# 🚀 Running & Deploying HashTag Creations

Complete, verified instructions to run the store locally and deploy it to production.
HashTag Creations is a 3D-printed products store: **Next.js 14** frontend + **NestJS** API +
**PostgreSQL/Prisma**, with **Razorpay** payments and **INR / GST** pricing.

- Storefront: **http://localhost:3000**
- API: **http://localhost:4000/api/v1** · Swagger: **http://localhost:4000/api/docs**

---

## 🔑 Test accounts (seeded)

Created by the database seed (`npm run db:setup` / `npm run prisma:seed`). Sign in at
**http://localhost:3000/login**.

| Role | Email | Password | Access |
|------|-------|----------|--------|
| **Admin** | `admin@hashtagcreations.in` | `Admin123!` | Full admin dashboard at `/admin` (products, orders, inventory, coupons, users, analytics) |
| **Customer** | `customer@hashtagcreations.in` | `Customer123!` | Storefront, cart, checkout, order history, wishlist |

> The admin password can be overridden via `SEED_ADMIN_PASSWORD` in `backend/.env` before seeding.
> Re-seed any time with `npm run db:setup` (idempotent) or `npm run db:reset` (wipes + reseeds).
> **Change/remove these accounts before going to production.**

---

## 0. Prerequisites

- **Node.js 20+** and npm 10+
- **PostgreSQL 16** (local install *or* Docker)
- *(optional)* **Redis 7** — caching + rate-limit storage; the app runs fine without it
- *(optional, for real payments)* a **Razorpay** account (test keys are free)

---

## 1. Local development — Option A: run on the host (recommended, no Docker)

This is the exact flow used to verify the app on macOS (Homebrew). Adapt the Postgres
install to your OS.

### 1.1 Install & start PostgreSQL
```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16          # auto-starts on login
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"   # so psql/pg_isready are on PATH

# create the app role + database (matches backend/.env DATABASE_URL)
createuser -s forge3d
psql -d postgres -c "ALTER USER forge3d WITH PASSWORD 'forge3d';"
createdb -O forge3d forge3d
```
> The DB/role are named `forge3d` internally (unrelated to the brand). To change it,
> update `DATABASE_URL` in `backend/.env` to match.

### 1.2 Configure environment
```bash
cp backend/.env.example backend/.env        # dev JWT secrets are fine as-is
cp frontend/.env.example frontend/.env.local
```
`backend/.env` already points `DATABASE_URL` at `postgresql://forge3d:forge3d@localhost:5432/forge3d`.
Leave Razorpay/SMTP/S3 blank to browse & test; add them later (see §3).

### 1.3 Install dependencies, set up the DB, run
From the **project root**:
```bash
npm run install:all     # installs root + backend + frontend deps
npm run db:setup        # applies migrations + seeds demo data (INR catalog, accounts)
npm run dev             # starts API (:4000) + storefront (:3000) together
```
Open http://localhost:3000. Stop everything with `Ctrl-C` (or `npm run stop`).

---

## 1'. Local development — Option B: Docker Compose

Requires a Docker **daemon** + the Compose plugin (Docker Desktop, or Colima + `docker-compose`).
> `brew install docker` installs only the CLI. Use `brew install --cask docker-desktop`,
> or `brew install colima docker-compose && colima start`.

```bash
cp .env.example .env     # set POSTGRES_PASSWORD, JWT secrets, Razorpay keys, etc.
docker compose up --build
```
- Postgres, Redis, backend, and frontend all start; **migrations run automatically** on backend boot.
- To seed demo data: set `SEED_ON_START=true` for the backend service, or run
  `docker compose exec backend node dist/prisma/seed.js`.

---

## 2. Root npm scripts (run from the project root)

| Command | What it does |
|---|---|
| `npm run dev` | Start backend + frontend together (watch mode), color-prefixed logs |
| `npm run build` | **Production build of both apps** (Prisma generate + `nest build` + `next build`) |
| `npm run build:backend` / `build:frontend` | Production build of just one app |
| `npm start` | Run both in production mode (`node dist/src/main.js` + `next start`) |
| `npm run prod` | **Build then run** both in production mode (`build` + `start`) |
| `npm run install:all` | Install root + backend + frontend deps |
| `npm run db:setup` | `prisma migrate deploy` + seed |
| `npm run db:reset` | Drop → recreate → migrate → seed (**dev only**) |
| `npm run stop` | Stop everything — kills the watchers (`nest --watch`, `next dev`, `concurrently`) **and** frees ports 4000/3000 |

> **Stopping:** always use `npm run stop` (or `Ctrl-C` in the terminal running `npm run dev`).
> Killing only the ports isn't enough — the file watchers respawn the servers, so `stop`
> terminates the watcher parents first, then frees the ports.

Backend-only scripts (run in `backend/`): `npm run start:dev`, `prisma:migrate`,
`prisma:deploy`, `prisma:seed`, `prisma:studio`, `db:reset`, `build`, `test`, `lint`.

---

## 3. Environment variables

Three env files, each with an `.env.example` template. **Never commit real `.env` files.**
Generate secrets with `openssl rand -base64 48`.

### `backend/.env`
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (required) |
| `REDIS_URL` | Redis URL — leave blank to disable (cache no-ops, in-memory throttling) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | JWT signing (≥16 chars, required) |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Token lifetimes (default `900s` / `7d`) |
| `COOKIE_SECRET` | Signs the refresh cookie |
| `FRONTEND_URL` | CORS origin (default `http://localhost:3000`) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **Razorpay** — needed for checkout |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies Razorpay webhooks |
| `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | **Shiprocket** API user — needed to create shipments / AWBs (see §3.1) |
| `SHIPROCKET_PICKUP_LOCATION` | Pickup location nickname configured in Shiprocket |
| `SHIPROCKET_CHANNEL_ID` | Shiprocket channel id (optional) |
| `SHIPROCKET_WEBHOOK_TOKEN` | Shared secret for the Shiprocket tracking webhook (`x-api-key`) |
| `CHATBOT_API_URL`, `CHATBOT_API_KEY`, `CHATBOT_MODEL` | **Chatbot LLM** — optional OpenAI-compatible endpoint for generative RAG (blank = extractive). See §Chatbot |
| `CHATBOT_EMBED_URL`, `CHATBOT_EMBED_MODEL` | Optional embeddings endpoint for neural retrieval (blank = built-in BM25) |
| `SMTP_*` | Transactional email (emails log to console when unset) |
| `S3_*` | AWS S3 / Cloudflare R2 presigned uploads. **Optional** — when `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` are unset the backend falls back to **local-disk storage** (see §File uploads) so uploads work with zero config in dev |
| `STORAGE_PUBLIC_URL` | Base URL for local-disk files (optional; defaults to `http://localhost:<PORT>`). Only used by the local-disk fallback |
| `GOOGLE_*` | Google OAuth (optional) |
| `SEED_ADMIN_PASSWORD` | Admin password used by the seed (default `Admin123!`) |

### `frontend/.env.local`
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL the browser calls |
| `API_INTERNAL_URL` | API base URL for server components (Docker network) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key id (safe to expose) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL (metadata) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp click-to-chat number, digits only (default `917017109861`) |

### Razorpay setup (to take real payments)
1. Create test API keys at **dashboard.razorpay.com → Settings → API Keys**.
2. Put `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `backend/.env` and the same key id in
   `frontend/.env.local` as `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Create a webhook → URL `https://<api-host>/api/v1/payments/webhook`, events
   `payment.captured`, `payment.failed`, `refund.processed`; put the signing secret in
   `RAZORPAY_WEBHOOK_SECRET`.
4. Restart (`npm run dev`). Razorpay test mode supports UPI, cards, net banking & wallets.

Until keys are set, checkout shows a "payments not configured" notice; everything up to the
pay button works.

---

## Shipping (Shiprocket)

Shiprocket handles **shipping/fulfilment only** — payments stay on **Razorpay**. After an order
is paid, an admin creates the shipment through Shiprocket, which assigns a courier + AWB and gives
the customer a trackable link.

### Env vars (`backend/.env`)
| Var | Purpose |
|---|---|
| `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` | Credentials of a Shiprocket **API user** — required to create shipments / AWBs |
| `SHIPROCKET_PICKUP_LOCATION` | Pickup location nickname configured in your Shiprocket account |
| `SHIPROCKET_CHANNEL_ID` | Shiprocket channel id (**optional**) |
| `SHIPROCKET_WEBHOOK_TOKEN` | Shared secret the tracking webhook must send in the `x-api-key` header |

Create the API user in the **Shiprocket dashboard → Settings → API** (a dedicated API user,
separate from your login), then put its email/password in `backend/.env` and restart the API.

### Flow
1. An admin opens an order in the admin dashboard and clicks **"Ship via Shiprocket"**.
2. The backend creates a Shiprocket shipment, assigns a courier and **AWB**, and moves the order
   to **SHIPPED** (recording `awbCode`, `courierName`, `trackingUrl`, `shippedAt`).
3. The customer sees a clickable **tracking link** on their order and can follow live status.

### Tracking webhook (auto status sync)
Configure a Shiprocket **tracking webhook** to:

```
POST {API_URL}/api/v1/shipping/webhook
header  x-api-key: <SHIPROCKET_WEBHOOK_TOKEN>
```

Shiprocket then pushes status updates so the order status auto-syncs (e.g. **Shipped** →
**Delivered**) without manual admin action. Requests without a matching `x-api-key` are rejected.

### Without credentials
If `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` are unset, the **"Ship via Shiprocket"** action
returns a friendly *"Shiprocket is not configured…"* message instead of failing — the rest of
order management keeps working.

---

## Support chat (RAG chatbot) & WhatsApp

The storefront has two floating buttons (bottom-right): a **WhatsApp** click-to-chat button and an
AI **chat widget**. The chatbot is a **RAG** (Retrieval-Augmented Generation) assistant — it does
**not** use hardcoded answers.

### How the RAG bot works
1. **Knowledge base** (`knowledge_chunks` table) = store policy docs (shipping, payments, returns,
   GST, custom prints, lithophane, discounts, accounts, contact) **+ one auto-generated doc per
   active product** (name, description, price, options, stock, category). It's rebuilt from your
   live catalog.
2. **Retrieval** finds the most relevant chunks for the question:
   - **Default (offline):** a built-in **BM25** lexical ranker — strong and free, no external API.
   - **Optional:** set `CHATBOT_EMBED_URL` (+ `CHATBOT_EMBED_MODEL`) to an OpenAI-compatible
     embeddings endpoint for **neural vector retrieval**.
3. **Answer:**
   - **With an LLM** (`CHATBOT_API_URL`): an open-source model **generates** a reply grounded only
     in the retrieved context (Ollama / Groq / Together / HuggingFace, etc.).
   - **Without an LLM (default):** returns the best-matching retrieved snippet (extractive RAG).
   - **No relevant match:** the bot says it isn't sure, points to WhatsApp, and flags the
     conversation for a human (**needs reply**).
4. Every conversation is **logged**; admins review them at **Admin → Support chat** (filter by
   status / "needs human", reply, mark Handled/Closed).

### Enable full generative RAG (open-source LLM)
```bash
# backend/.env  (example: local Ollama)
CHATBOT_API_URL=http://localhost:11434/v1
CHATBOT_MODEL=llama3.1
# optional neural retrieval:
CHATBOT_EMBED_URL=http://localhost:11434/v1
CHATBOT_EMBED_MODEL=nomic-embed-text
```
Restart, then in **Admin → Support chat** click **"Reindex AI knowledge"** (or `POST
/api/v1/admin/chat/reindex`). The KB also auto-indexes on first boot. Reindex after big catalog or
policy changes so the bot stays current.

### WhatsApp button
Set `NEXT_PUBLIC_WHATSAPP_NUMBER` (digits only, e.g. `917017109861`). The button opens
`https://wa.me/<number>?text=Hi`. Edit the knowledge text in `backend/src/chat/knowledge.data.ts`.

---

## File uploads (product images, videos & 3D models)

Admins upload media from **Admin → Products → (a product) → Media** ("Upload images, videos
& 3D models"). Customers upload custom STL/photos on customizable products. Uploads use a
presign → direct-PUT flow, with two interchangeable storage drivers:

- **Cloud (S3 / Cloudflare R2)** — used when `S3_ACCESS_KEY_ID` **and** `S3_SECRET_ACCESS_KEY`
  are set. The browser PUTs straight to a presigned bucket URL. Also set `S3_BUCKET`,
  `S3_REGION`, `S3_PUBLIC_URL` (and `S3_ENDPOINT` for R2/MinIO). Configure bucket CORS to allow
  `PUT` from your site origin.
- **Local disk (default dev fallback)** — used automatically when those creds are **unset**
  (the backend logs a warning at startup). Files are written under `backend/storage/` and served
  at `http://localhost:<PORT>/files/...`. Zero config, no Docker, no cloud account. Set
  `STORAGE_PUBLIC_URL` if the API isn't reachable at `http://localhost:<PORT>` from the browser.
  Not for production — use S3/R2 there.

Supported 3D formats: **`.stl` / `.obj`**, rendered by the interactive viewer on the product
page. `backend/storage/` is git-ignored.

---

## 4. Database

Schema: `backend/prisma/schema.prisma`. Money is integer **paise** (INR). Migrations live in
`backend/prisma/migrations/`.

```bash
cd backend
npm run prisma:migrate     # create a dev migration after editing the schema
npm run prisma:deploy      # apply migrations (prod / CI)
npm run prisma:seed        # seed demo data
npm run prisma:studio      # browse data in the browser
npm run db:reset           # drop + recreate + seed (dev only!)
```

---

## 5. Production deployment

### 5.1 Docker Compose (single host)
```bash
cp .env.example .env
# Edit .env: strong POSTGRES_PASSWORD; JWT_ACCESS_SECRET / JWT_REFRESH_SECRET (openssl rand -base64 48);
# COOKIE_SECRET; RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET; SMTP_*; S3_*;
# NEXT_PUBLIC_API_URL + NEXT_PUBLIC_RAZORPAY_KEY_ID (baked into the frontend at build time).

docker compose up --build -d
docker compose logs -f backend          # backend runs `prisma migrate deploy` on start
docker compose exec backend node dist/prisma/seed.js   # optional first-run seed
```
Services: `postgres`, `redis`, `backend` (NestJS, port 4000), `frontend` (Next.js standalone, port 3000),
each with healthchecks and `restart: unless-stopped`.

### 5.1b Without Docker (bare metal / VM)
With Node 20+ and Postgres reachable via `DATABASE_URL`, from the project root:
```bash
npm run install:all
npm run db:setup          # prisma migrate deploy + seed (seed optional in prod)
npm run build             # production build of both apps (Prisma generate + nest build + next build)
npm start                 # run both in production mode (or: npm run prod = build + start)
```
For a long-running deployment, supervise each app with **PM2**/systemd instead of `npm start`:
`pm2 start "node dist/src/main.js" --name api` (in `backend/`, after `npm run build`) and
`pm2 start "npm run start" --name web` (in `frontend/`). Set `NODE_ENV=production` and provide the
`NEXT_PUBLIC_*` vars at **build time** for the frontend.

### 5.2 Production checklist
- **HTTPS only**: terminate TLS at a reverse proxy (nginx/Caddy/ALB) in front of both services.
  Secure cookies require HTTPS in production (`NODE_ENV=production`).
- **Secrets**: inject via your platform's secret manager, not committed files. Rotate JWT secrets
  away from the dev defaults.
- **`NEXT_PUBLIC_*` are build-time** — they're baked into the frontend image; rebuild the frontend
  if they change (`docker compose build frontend`).
- **CORS**: set `FRONTEND_URL` to your real storefront origin.
- **Razorpay webhook** must point at the public API URL with `RAZORPAY_WEBHOOK_SECRET` set.
- **Migrations**: `prisma migrate deploy` runs automatically in the backend entrypoint; for
  manual control run it in your release step.
- **Backups**: schedule `pg_dump` for the Postgres volume.
- **Scaling**: set `REDIS_URL` so rate-limiting/cache work across multiple backend instances.

### 5.3 Building images individually
```bash
docker build -t hashtag-backend ./backend
docker build -t hashtag-frontend ./frontend \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx \
  --build-arg NEXT_PUBLIC_SITE_URL=https://example.com
```

### 5.4 CI/CD
`.github/workflows/ci.yml` runs on every push/PR: lint + build for both apps (backend also
generates the Prisma client), then builds both Docker images. Extend the `docker` job with a
push/deploy step for your registry/host.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE` on 4000/3000 | Another instance is running — `npm run stop` (or `lsof -ti:4000 \| xargs kill`). |
| `docker: unknown command: compose` | Compose plugin/daemon missing — install Docker Desktop or `colima` + `docker-compose`. |
| `npm ERR! 403 Forbidden` on install | A corporate registry blocked a package version — bump it to a patched release (e.g. `next` 14.2.x). |
| Seed: `spawn ts-node ENOENT` | Use the provided scripts (`npm run prisma:seed`); they invoke `node -r ts-node/register`. |
| Checkout shows "payments not configured" | Add Razorpay keys (see §3). |
| Emails not arriving | SMTP unset → emails are logged to the backend console; set `SMTP_*` to send. |
| Health check | `curl http://localhost:4000/api/v1/health` → `{"status":"ok","db":"ok"}` |
