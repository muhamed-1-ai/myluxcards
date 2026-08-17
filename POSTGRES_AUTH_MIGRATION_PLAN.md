# Fresh PostgreSQL and Auth.js Migration Plan

## Decision and scope

MyLuxCards will start with a fresh Coolify PostgreSQL 18.4 database. No Supabase users, password hashes, customers, orders, cards, affiliates, payments, media, or other historical data will be imported. The target runtime is:

```text
Next.js -> Auth.js -> direct PostgreSQL -> Coolify PostgreSQL
```

This is the required design checkpoint before implementation. No production SQL, user creation, role promotion, runtime rewrite, or Supabase deletion is authorized by this document. `DATABASE_RECOVERY_PLAN.md` describes the prior recovery option and is superseded for implementation by the fresh-database decision recorded here.

## Current runtime migration map

### Shared Supabase infrastructure

| Current file | Current responsibility | Direct-PostgreSQL replacement |
|---|---|---|
| `src/lib/supabaseAuth.ts` | Supabase config, PostgREST wrapper, Auth API wrapper. | Remove after all callers move to repositories/Auth.js. Replace database access with `src/lib/db/index.ts`; Auth API calls with Auth.js flows. |
| `src/lib/adminAuth.ts` | Resolves either Supabase access cookie or Auth.js Google JWT, loads `profiles` through PostgREST, authorizes roles, writes audit logs. | Resolve only Auth.js session; load canonical user/profile through `usersRepository`; keep origin checks; write through `auditLogsRepository`. |
| `src/lib/auth.ts` | Google Auth.js provider, JWT session, but provisions/looks up users in Supabase Auth/PostgREST. | Add Credentials + Google providers; resolve/link both to canonical PostgreSQL users; JWT contains stable user ID only; current role/status is loaded server-side. |
| `src/middleware.ts` | Performs affiliate attribution lookups and writes visitors/clicks via PostgREST. | Middleware must not query PostgreSQL in an Edge runtime. Keep lightweight cookie parsing there; move validation/persistence to a Node route/server boundary using `affiliatesRepository`. |
| `scripts/create-super-admin.ts` | Supabase admin-user creation/promotion workflow. | Retire only after replacement is verified. Add `scripts/promote-super-admin.ts`, which promotes one existing PostgreSQL user and audits it. |

### Authentication routes

| Feature/files | Current dependency | Target |
|---|---|---|
| `api/auth/signup` | Supabase `/auth/v1/admin/users`, `/signup`, password token login. | Validate and normalize; Argon2id hash; transactionally insert `users` + `profiles` as CUSTOMER; duplicate-safe status; frontend then signs in through Auth.js Credentials. |
| `api/auth/login` | Supabase password grant and `mlc_*` cookies. | Auth.js Credentials provider is the sole password verification/session issuer. Update the existing login UI to call `signIn("credentials")`; do not handcraft Auth.js cookies. Remove/retire compatibility route only when callers are migrated. |
| `api/auth/logout` | Clears Supabase and Auth.js cookies manually. | Use Auth.js `signOut`; preserve POST/origin protection. |
| `api/auth/me` | `currentIdentity()` hybrid lookup. | Return the canonical Auth.js identity and fresh role/status from PostgreSQL, preserving the current response shape. |
| `api/auth/refresh` | Supabase refresh-token exchange. | Delete after all clients use Auth.js; JWT cookie rotation is handled by Auth.js. No separate refresh-token cookie. |
| `api/auth/forgot-password`, `reset-password`, `change-password`, `resend-confirmation` | Supabase recovery/user endpoints and tokens. | Purpose-specific, hashed, single-use PostgreSQL tokens with expiry/attempt limits; existing mail layer sends links. Password mutation revokes active login state. Generic responses prevent account enumeration. |
| `api/auth/[...nextauth]` | Existing Google-only Auth.js handler. | Remains the unified Auth.js handler with Credentials + Google providers and canonical account linking. |

### Business repositories and callers

All calls currently use `${SUPABASE_URL}/rest/v1/...`, usually through `supabaseJson()`. Replace them with parameterized repository methods; do not embed SQL throughout route handlers.

| Repository | Tables | Current caller areas |
|---|---|---|
| `users.ts` / `profiles.ts` | `users`, `accounts`, `profiles`, auth tokens | Auth routes, `adminAuth`, Google provisioning, admin customers/admins, dashboard identity. |
| `products.ts` | `products` | Product page, admin products, checkout, affiliate QR/leads, dashboard counts. |
| `orders.ts` | `orders`, `order_items` | Checkout, customer orders/invoices, admin orders/dashboard/customers, affiliate commission calculation. |
| `payments.ts` | `payments`, `payment_webhook_events` | Checkout, Razorpay verify/webhook, admin payments/dashboard. |
| `cards.ts` | `cards`, `card_activations`, `digital_cards`, `card_events`, `card_leads` | Customer card CRUD/activation/public card/leads, admin card provisioning, uploads, customer detail. |
| `affiliates.ts` | All 22 existing `affiliate_*` tables | Affiliate apply/dashboard/campaigns/export/leads/payouts/QR, cron, middleware attribution, all admin affiliate routes, affiliate terms and notification helpers. |
| `support.ts` | `support_tickets`, `support_ticket_replies` | Public support, admin support, customer detail. |
| `notifications.ts` | `admin_notifications`, `affiliate_email_events` | Order/affiliate notification helpers, support fallback, admin notifications/dashboard. |
| `auditLogs.ts` | `admin_audit_logs` | Admin audit helper/route and promotion script. |
| `settings.ts` | `website_settings`, `affiliate_settings` | Admin settings, affiliate program configuration/terms/middleware behavior. |

Direct PostgREST callers to migrate include:

- Admin: admins, audit, dashboard, customers/detail/reset, products, orders, payments, settings, notifications, support, card activation, and every affiliate administration route.
- Customer/public: cards, card activation/public card/leads, orders/invoices, checkout, support, products, media, and Razorpay verification/webhook.
- Affiliate: apply, dashboard, campaigns, leads, payouts, QR, export, commission cron, terms, shared attribution and notification libraries.

The current code directly addresses 33 of the 36 existing public tables. `affiliate_attributions`, `affiliate_coupons`, and `affiliate_tier_history` exist in migration design but have no direct `/rest/v1/<table>` call today; retain them only because they encode planned/transactional affiliate behavior, and reassess during the affiliate stage.

## Database access layer

Use the existing `pg` package. A lightweight in-project migration runner is preferable to adding an ORM because the application already has a large SQL-first schema, uses PostgreSQL enums/checks/generated columns/functions, and needs precise transactions.

### `src/lib/db/index.ts`

- Create one module-level `Pool`, cached through `globalThis` in development to survive Next.js hot reload.
- Support standard `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and `DATABASE_URL`. If complete `PG*` connection fields are present, use them consistently; otherwise use `DATABASE_URL`.
- Read SSL behavior from an explicit server-only option appropriate to Coolify; never silently disable certificate validation for public endpoints.
- Set bounded pool size, connection timeout, idle timeout, statement timeout, application name, and an error listener that logs no connection string or query parameters.
- Export `query(text, params)`, `withTransaction(callback, options)`, and a narrow health check. All values must use `$1...$n`; dynamic identifiers are disallowed except through strict internal allowlists.
- `withTransaction` acquires/releases one client in `finally`, uses `BEGIN`, optional isolation level, `COMMIT`, and guarded `ROLLBACK`.
- Mark database modules server-only and never import them into Client Components or Edge middleware.

### Migration mechanism

Add versioned files under `db/migrations`, plus a Node/TypeScript runner under `scripts/migrate-db.ts`:

- `schema_migrations(version text primary key, checksum text, applied_at timestamptz)` records immutable migrations.
- Acquire a PostgreSQL advisory lock so only one deploy migrates at a time.
- Verify stored checksums and refuse edited-applied migrations.
- Execute each migration transactionally where PostgreSQL permits it; make enum changes separate when necessary.
- Provide `npm run db:migrate` and a read-only `npm run db:migrate:status`.
- No automatic destructive down migration in production. Rollback is restore/forward-fix based and documented per release.

## Proposed fresh schema

### Authentication and authorization

#### `users`

- `id uuid primary key default gen_random_uuid()`
- `email text not null`
- `normalized_email text not null unique`
- `name text not null`
- `password_hash text null`
- `email_verified_at timestamptz null`
- `image text null`
- `role app_role not null default 'CUSTOMER'`
- `status account_status not null default 'ACTIVE'`
- `disabled boolean not null default false`
- `must_change_password boolean not null default false`
- `role_version integer not null default 1`
- `session_version integer not null default 1`
- `created_at`, `updated_at`

`normalized_email` is computed by application normalization (`trim().toLowerCase()`) and uniquely constrained. A database check enforces `normalized_email = lower(btrim(email))`. No plaintext password is ever persisted. CUSTOMER is the only public-signup role.

#### `accounts`

Provider identities for Auth.js: `id`, `user_id -> users`, `provider`, `provider_account_id`, provider type and safe token metadata needed by Auth.js. Unique `(provider, provider_account_id)`. Sensitive provider tokens should not be stored unless the application needs downstream Google APIs; current login does not, so omit or discard them.

Google linking rules:

1. Require Google's `email_verified=true`.
2. Lock/select by normalized email in a transaction.
3. If the user exists, attach the Google account to that exact user unless it is already linked elsewhere.
4. If absent, insert one CUSTOMER user/profile and account atomically.
5. Unique normalized email and provider-account constraints make races safe.
6. Never elevate a role through OAuth metadata and never auto-link an unverified email.

#### Sessions

Use Auth.js JWT sessions initially; no `sessions` table is necessary. The encrypted/signed HTTP-only cookie is the only browser session token. Store stable `user.id` and `session_version` in the JWT, not authoritative role permissions. Every protected server operation reloads current `role`, `disabled`, and `session_version` from PostgreSQL, so demotion/disablement takes effect. Incrementing `session_version` invalidates old sessions.

If later requirements demand server-listed/revocable individual sessions, add an Auth.js-compatible `sessions` table in a separate migration rather than creating an unused table now.

#### Auth action tokens and rate limits

- `auth_action_tokens`: UUID ID, user FK, purpose enum (`EMAIL_VERIFY`, `PASSWORD_RESET`), token hash only, expiry, consumed timestamp, attempts, timestamps; indexes for active lookup/cleanup.
- `auth_rate_limits`: hashed/derived subject and action bucket, window start, count, expiry; no raw passwords/tokens. This supports multi-instance Coolify deployment, unlike in-memory limits.

### Profile and existing business model

Keep `profiles.id uuid primary key references users(id) on delete cascade`. This is a normal canonical-user FK and preserves current response/ownership shapes without recreating `auth.users`. Keep customer-facing profile/contact fields here; move role/status/security fields to `users` so there is one authorization source of truth.

Retain the useful parts of the existing SQL-first business schema:

- Catalogue/commerce: `products`, `orders`, `order_items`, `payments`.
- Administration: `admin_audit_logs`, `admin_notifications`, `admin_invites`, `website_settings`.
- Affiliate: the current `affiliate_*` model, subject to per-table usage review in Stage 5.
- Digital experience: `digital_cards`, `card_events`, `card_leads`.
- Support: `support_tickets`, `support_ticket_replies`.

Rewrite every user FK to `users(id)` when it represents identity/authorization and to `profiles(id)` only when the row truly requires a profile. For minimal churn, both IDs remain the same UUID.

### Physical NFC inventory and activation

The existing `digital_cards` table stores customer-facing card content but does not represent the requested physical lifecycle. Add only two focused tables:

#### `cards`

- UUID PK; optional `owner_id -> users`; optional `digital_card_id -> digital_cards`
- Unique random `public_token` (at least 128 bits, URL-safe; store a lookup hash if threat modeling requires it)
- Optional unique inventory/serial reference
- `status card_status` with `UNASSIGNED`, `ASSIGNED`, `PROGRAMMED`, `TESTED`, `SHIPPED`, `ACTIVATED`, `ACTIVE`, `DISABLED`, `REPLACED`, `LOST`
- `replacement_card_id`, assigned/programmed/tested/shipped/activated timestamps, created/updated timestamps
- Constraints that prevent impossible ownership/replacement combinations

#### `card_activations`

- UUID PK; `card_id -> cards`; optional actor/user; activation token hash; expiry, used/revoked timestamps; created timestamp
- Unique active token semantics enforced transactionally/with a partial index
- The public NFC/QR URL uses `public_token`, never a sequential identifier or activation secret

Keep `digital_cards.activation_code_hash` only during the compatibility transition; move activation secrets to `card_activations`, then remove the old column in a later migration after callers and tests move.

### Payments and affiliate integrity

Add `payment_webhook_events` with provider, unique provider event/transaction identity, payload hash or minimal redacted metadata, processing status, attempts and timestamps. Razorpay signature verification remains server-side before any payment/order mutation. Process each webhook in one transaction with row locks and unique constraints.

Affiliate commission invariants:

- Unique conversion per applicable order/item remains database-enforced.
- Commission creation requires a server-verified succeeded payment record.
- Self-referral checks compare canonical user IDs.
- Refund processing creates an idempotent adjustment/reversal and cannot double-reverse.
- Payout reservation retains the existing row-locking function semantics, adapted to normal PostgreSQL roles.

## Supabase SQL not carried into the fresh schema

- No `auth` schema, `auth.users`, `auth.identities`, `auth.uid()`, or `auth.jwt()`.
- No Supabase `anon`, `authenticated`, `service_role`, or `supabase_admin` grants/checks.
- No `on_auth_user_created` trigger or Supabase metadata-based profile provisioning.
- No Supabase Storage `storage.buckets`/`storage.objects` schema or policies.
- No RLS copied mechanically from Supabase. Authorization is initially enforced by authenticated, parameterized server repositories. Target-native least-privilege/RLS may be designed later where it adds defense in depth.
- Keep business constraints/indexes and adapt `request_affiliate_payout`, `notify_low_stock`, and the privileged-field protection intent to the new trust model.

## Password choice

Use Argon2id. The proposed implementation dependency is `@node-rs/argon2`, which provides maintained native prebuilds and avoids relying on a compiler toolchain in the Coolify image. Pin explicit Argon2id parameters after benchmarking inside the production-equivalent container, store the encoded PHC string, cap password input length, and perform verification even for a nonexistent account using a fixed dummy hash to reduce timing-based enumeration. If the Coolify target lacks a supported prebuild, stop and report that build evidence before choosing bcrypt; do not silently downgrade.

Password policy: 12–128 characters, with server-side strength checks consistent across signup/reset/change. Do not log request bodies or hash/verifier errors.

## Unified Auth.js behavior

- Credentials and Google both resolve to the same `users.id`.
- Auth.js issues only secure, HTTP-only, SameSite cookies; secure-cookie mode is mandatory in production.
- `AUTH_SECRET` remains required and stable across deployments.
- `/api/auth/me`, dashboard, orders, cards, affiliate pages, and admin guards all use one `currentIdentity()` implementation backed by Auth.js + PostgreSQL.
- Mutation routes retain origin/CSRF defenses. Auth.js endpoints retain Auth.js CSRF handling.
- ADMIN and SUPER_ADMIN are checked server-side on every action. SUPER_ADMIN-only operations include role/admin management, security/audit access, sensitive settings, and commission configuration.
- No endpoint accepts a public role value at signup and no public promotion endpoint exists.

## Staged implementation plan

### Stage 1 — schema and repository foundation

1. Add pool, transaction helper, migration runner, schema migrations, and repository unit-test seams.
2. Create fresh schema only in a disposable/local test PostgreSQL first; never run the production migration from an agent session without explicit authorization.
3. Implement repositories without switching routes. Add schema/transaction/constraint tests.
4. Run full tests/build. Review generated SQL, object inventory and migration status output.

### Stage 2 — authentication

1. Add Argon2id and canonical user/account/token/rate-limit repositories.
2. Configure Credentials + Google in Auth.js with transactional linking.
3. Replace signup, login UI/session creation, logout, me, password reset/change and verification flows.
4. Remove `mlc_access_token`/`mlc_refresh_token` only after all consumers use Auth.js.
5. Test signup, duplicate/weak password, valid/invalid login, cookie persistence/logout, me, Google create/login/link/races, disabled user and role freshness.

### Stage 3 — profiles and dashboard

Move identity/profile reads and dashboard protection to the unified session. Preserve response shapes and frontend design. Verify CUSTOMER-only behavior and session invalidation.

### Stage 4 — products, orders, payments, and cards

Move repositories route-by-route. Use transactions for checkout/order items/payment creation and activation. Add physical card lifecycle without changing public design. Preserve Razorpay signature verification and introduce webhook idempotency.

### Stage 5 — admin, affiliate, support, notifications, audit, settings, and media

Move each bounded domain and its tests, including the middleware attribution redesign. Decide target object storage before replacing the media route; direct PostgreSQL is not blob storage. Verify every role boundary and affiliate/payment invariant.

### Stage 6 — Supabase removal

Run repository-wide searches for `supabaseJson`, Supabase helpers, `/auth/v1`, `/rest/v1`, `SUPABASE_*`, `auth.uid()`, and `auth.users`. Only after zero runtime callers remain:

- Remove `src/lib/supabaseAuth.ts` and obsolete Supabase scripts/docs/runtime code.
- Remove Supabase environment variables from Coolify.
- Keep historical SQL only if intentionally archived and clearly marked non-runnable; otherwise remove it in a separately reviewed cleanup commit.

### Stage 7 — first SUPER_ADMIN

After migration, signup/login/profile/admin authorization tests pass in production, create a normal website account. Then run:

```bash
npx tsx scripts/promote-super-admin.ts EMAIL
```

The script will normalize the email, require exactly one existing active user, transactionally lock it, set `users.role='SUPER_ADMIN'`, increment `role_version`/`session_version`, insert an audit record, and print either success or `Account is already SUPER_ADMIN`. It will not create users or alter passwords.

## Test and acceptance matrix

Required automated coverage before production cutover:

1. Fresh/duplicate signup and weak-password rejection.
2. Correct/wrong password login, generic failures, rate limiting and no sensitive logs.
3. Logout, secure-cookie flags, session persistence/invalidation, and `/api/auth/me`.
4. Google first login, repeat login, verified-email linking, no duplicate user, and collision/race handling.
5. Customer dashboard/profile and customer/admin/SUPER_ADMIN authorization boundaries.
6. Transactional order creation and owner-scoped reads.
7. Card provisioning, lifecycle, activation replay protection, public token and ownership.
8. Affiliate attribution, self-referral prevention, unique conversion, paid-only commissions and refund reversal.
9. Razorpay signature verification, idempotent webhooks, and frontend inability to set paid status.
10. Public/admin support flow, notifications and audit logging.
11. Migration from an empty database, repeat migration no-op, checksum refusal, constraints/indexes/FKs, and rollback rehearsal.

Every stage must pass:

```bash
npm test
npm run build
```

## Coolify environment target

Required server-only database/auth variables:

- Either `DATABASE_URL`, or `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- Explicit database SSL setting if required by the Coolify network topology
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `NEXTAUTH_URL` for the currently installed Auth.js v4 deployment (the canonical HTTPS application URL)

Retain existing Razorpay, mail, cron, affiliate encryption/signing, and upload/storage secrets that active features require. No database or auth secret may use a `NEXT_PUBLIC_` prefix. Do not delete `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` until Stage 6 search proves zero runtime dependency.

## Deployment and rollback gates

1. Build and test a production-equivalent image.
2. Back up the intentionally empty Coolify database anyway and record migration status.
3. Deploy Stage 1 code, then run the explicitly approved `npm run db:migrate`; verify schema/version/counts with a read-only command.
4. Deploy each later stage only after its compatibility tests pass. During mixed stages, retain Supabase variables and old routes still needed by unmigrated domains.
5. Before Auth cutover, verify stable `AUTH_SECRET`, HTTPS, Google redirect URI, mail delivery, cookie domain and time synchronization.
6. Smoke-test signup/login/me/dashboard and role denial before opening traffic.
7. Roll back application images independently when migrations remain backward-compatible; use forward-fix migrations for schema changes. Restore the pre-migration backup only for an approved catastrophic rollback.

## Approval checkpoint

Before implementation, approve or revise these choices:

1. SQL migrations with an in-project `pg` runner rather than an ORM.
2. Auth.js JWT sessions with PostgreSQL-backed identity/status checks rather than a sessions table initially.
3. Argon2id via `@node-rs/argon2`, subject to a production-image build check.
4. `profiles.id = users.id` via a normal FK to minimize business/API churn.
5. Separate physical `cards`/`card_activations` from customer-facing `digital_cards`.
6. Staged route migration with Supabase retained until the final zero-dependency check.

No high-risk implementation should begin until this checkpoint is accepted.
