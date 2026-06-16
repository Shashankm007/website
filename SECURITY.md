# Security overview

How HashTag Creations implements the required industry-standard controls.

## Authentication & sessions
- **Password hashing:** bcrypt, cost factor 12 (`auth.service.ts`, `seed.ts`).
- **Access tokens:** short-lived JWTs (~15 min), sent as `Authorization: Bearer`. Verified by the
  `jwt` Passport strategy, which also re-checks the account exists and is not blocked on every request.
- **Refresh tokens:** opaque 48-byte random strings, **SHA-256 hashed at rest** (`RefreshToken` table),
  ~7-day TTL. **Rotated on every refresh**; the old token is revoked and linked to its replacement.
  Reuse of a revoked token revokes the entire token family (theft detection).
- **Cookie:** refresh token delivered as `httpOnly`, `Secure` (prod), `SameSite=Lax`, scoped to
  `/api/v1/auth`. The access token is held **in memory** client-side (never `localStorage`).
- **Password change / reset** revokes all of a user's refresh tokens.
- **Email verification & password reset** use single-use, hashed, time-boxed tokens; forgot-password
  responses are constant ("if an account exists…") to prevent enumeration.

## Authorization (RBAC)
- Global `JwtAuthGuard` protects every route unless explicitly `@Public()`.
- `RolesGuard` + `@Roles(Role.ADMIN)` gate all admin endpoints; blocked users are rejected (403).
- Resource ownership checks on customer data (orders, addresses, reviews, cart).

## API hardening
- **Input validation:** global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` + `transform`;
  all DTOs use `class-validator`.
- **Injection:** Prisma parameterizes all queries; the single `$queryRaw` (health check) uses a tagged template.
- **XSS:** user rich text sanitized server-side (`sanitize-html`); React escapes output by default.
- **CSRF:** state-changing requests authenticate via a Bearer access token (not an ambient cookie);
  the only cookie is the path-scoped, `SameSite=Lax` refresh token.
- **Headers:** `helmet` sets secure defaults; Next.js adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- **CORS:** locked to `FRONTEND_URL` with credentials.
- **Rate limiting:** global throttler (120 req/min) with much stricter limits on auth endpoints
  (login/register 10/min, reset/forgot 5/min); Redis-backed when available for multi-instance correctness.

## Data protection
- Secrets only via environment variables; `.env` git-ignored; `.env.example` documents every key.
- `ENCRYPTION_KEY` provided for encrypting sensitive fields where needed.
- HTTPS assumed in production (secure cookies, HSTS via reverse proxy/helmet).
- Razorpay webhook HMAC signature (`x-razorpay-signature` header) verified against the raw body.

## Auditing & monitoring
- Privileged/admin mutations recorded in `AuditLog` (actor, action, entity, metadata, IP).
- Structured request logging + latency via a global interceptor; 5xx errors logged with stack traces.

## Reporting
Please report vulnerabilities privately to security@hashtagcreations.in rather than opening a public issue.
