# MyLuxCards Database Recovery Plan

## Status and safety boundary

The production audit reached Coolify PostgreSQL 18.4 successfully and found only the `public` schema, no `auth` schema, no `public.profiles`, no Supabase auth tables, no profile/auth foreign key, and no role schema. Its migration classification was Case C: important application tables are missing.

This document is an inventory and recovery design only. It does not authorize connecting to the old Supabase database, changing production, running migrations, creating users or a `SUPER_ADMIN`, or removing the current Supabase integration. Path 2 must not begin until the old Supabase project's recoverability has been explicitly determined.

## Repository sources of truth

The repository contains six SQL migrations, in this required order:

1. `supabase/migrations/202607250001_super_admin.sql` — `pgcrypto`, core enums, profiles, commerce, payments, administration, settings, profile triggers, and core RLS.
2. `supabase/migrations/202607300001_affiliate_program.sql` — affiliate enums and foundation tables, order attribution columns, payout function, and affiliate RLS.
3. `supabase/migrations/202607300002_mylux_partner_program.sql` — partner enums/columns, attribution, coupons, adjustments, tiers/history, business leads, rewards, store credits, and additional RLS.
4. `supabase/migrations/202607300003_partner_payout_reservation.sql` — replaces the payout function after the `RESERVED_FOR_PAYOUT` enum value is committed.
5. `supabase/migrations/202607300004_smart_cards.sql` — digital cards, card events, leads, indexes, and owner RLS.
6. `supabase/migrations/202608010001_card_media_support.sql` — Supabase Storage bucket/policy, support tables, and low-stock notification triggers.

No other repository SQL schema, seed directory, Prisma schema, or Drizzle schema was found. The migrations contain small reference-data inserts for affiliate tiers, affiliate settings, reward definitions, and website settings; there is no customer/user seed. The `create:super-admin` script is an operational utility, not a migration, and must not be run in this phase.

## Database object inventory

All 36 application tables defined by the repository belong to `public`. Unless a row says otherwise, the primary key is a UUID generated with `gen_random_uuid()`. “RLS: server-only” means RLS is enabled but no browser policy is defined; current server routes use the Supabase service role to bypass it.

### Identity, commerce, and administration

| Table | Purpose and important columns | Keys, indexes, policies, and dependencies |
|---|---|---|
| `profiles` | Canonical application profile and authorization state: `id`, `email`, `name`, `phone`, `role`, `status`, `disabled`, `must_change_password`, `internal_notes`, `role_version`, timestamps. | PK `id` is also FK to `auth.users(id)` with cascade. Unique `lower(email)`; index `(role, created_at desc)`. Own-read/own-update policies use `auth.uid()`. `handle_new_auth_user` inserts it; `protect_profile_security_fields` guards privileged fields. |
| `products` | Product catalogue, type/SKU, minor-unit prices, stock thresholds, JSON images/variants, publication/archive and SEO fields. | Unique `slug`, unique `sku`; indexes `(product_type, active)` and `stock`; public read policy only for active, unarchived products. Low-stock triggers call `notify_low_stock`. |
| `orders` | Customer/order snapshot, lifecycle and payment status, totals, addresses, fulfillment fields, plus all affiliate attribution columns added later. | Unique `order_number`; nullable FK `customer_id -> profiles`; later FKs to `affiliate_profiles`, `affiliate_campaigns`, and `affiliate_business_leads`. Indexes on creation, statuses, customer, and affiliate. Own-read uses `auth.uid()`. |
| `order_items` | Immutable product snapshot, quantity and minor-unit price; `total_minor` is a stored generated column. | FK `order_id -> orders` cascade; nullable `product_id -> products` restrict; index `order_id`. Own-read is inherited through the owning order and `auth.uid()`. |
| `payments` | Provider transaction, order, amount/currency, payment/refund state and failure information. | FK `order_id -> orders` restrict; unique `(provider, provider_transaction_id)`; indexes by order and `(status, created_at desc)`; RLS server-only. |
| `admin_audit_logs` | Append-oriented administrative action record with scrubbed before/after JSON, actor snapshot, IP and user agent. | Bigint identity PK; nullable `actor_id -> profiles`; indexes by creation and `(entity_type, entity_id)`; RLS server-only. |
| `admin_notifications` | Idempotent operational notifications, optional order/email delivery state and read state. | Unique `event_key`; nullable `order_id -> orders` cascade; created index; RLS server-only. Low-stock and application code write here. |
| `admin_invites` | Hashed admin invitations and lifecycle timestamps. | Unique `token_hash`; `invited_by -> profiles`; role constrained to `ADMIN`; lower-email/created index; RLS server-only. |
| `website_settings` | Singleton business, contact, currency, shipping, tax, invoice, social and maintenance configuration. | Boolean singleton PK constrained true; nullable `updated_by -> profiles`; RLS server-only; migration inserts the singleton default row. |

There is no separate `admins` table: administrators are rows in `profiles` with the `ADMIN` or `SUPER_ADMIN` enum role. There is also no repository-defined `users`, `accounts`, or `sessions` table. Supabase `auth.users` is the current identity root; current Google Auth.js sessions use JWT strategy and still map to a Supabase-backed profile.

### Affiliate and partner program

| Table | Purpose and important columns | Keys, indexes, policies, and dependencies |
|---|---|---|
| `affiliate_tiers` | Tier thresholds, commission rule/value, benefits and active state. | Unique `name`; active-tier read policy; migration seeds STARTER/SILVER/GOLD/PLATINUM. |
| `affiliate_profiles` | One affiliate per user; approval, code/coupon, tier, base/temporary commission, partner type, payout ciphertext and lifecycle fields. | Unique `user_id -> profiles`, codes/coupons (including case-insensitive partial unique indexes), nullable tier/approver FKs; status and partner-type indexes; own-read via `auth.uid()`. |
| `affiliate_applications` | Application form and decision history tied to both affiliate and user. | FKs to `affiliate_profiles` and `profiles`; approver FK; partial unique active application per user; status index; own-read via `auth.uid()`. |
| `affiliate_settings` | Singleton commission, attribution, payout, partner-type, coupon, lead and program settings. | Boolean singleton PK; nullable `updated_by -> profiles`; migration inserts default row; RLS server-only. |
| `affiliate_product_rates` | Product-specific rate optionally scoped to one affiliate or tier. | FKs to product/profile/tier; check permits at most one affiliate/tier scope; expression unique scope index; RLS server-only. |
| `affiliate_campaigns` | Affiliate destination/source campaign definitions. | FK to affiliate; unique `(affiliate_id, name)`; affiliate/created index; own-read via `auth.uid()`. |
| `affiliate_visitors` | Privacy-oriented visitor hash and first/last-seen state. | FK to affiliate; unique `(affiliate_id, visitor_hash)`; RLS server-only. |
| `affiliate_clicks` | Click analytics with affiliate/campaign, visitor hash, destination and source. | Bigint identity PK; affiliate/campaign FKs; affiliate/created and campaign/created indexes; RLS server-only. |
| `affiliate_commissions` | Order/item commission calculation, monetary snapshot, risk and payout lifecycle. | FKs to affiliate, order, optional order item; unique `(order_id, order_item_id)` plus partial one-order commission uniqueness; affiliate/status and pending-eligibility indexes; own-read via `auth.uid()`. |
| `affiliate_payouts` | Payout request/review/payment state and encrypted payout snapshot. | FK to affiliate and nullable reviewer profile; status/requested and affiliate/requested indexes; own-read via `auth.uid()`. |
| `affiliate_payout_items` | Join/reservation of commissions in a payout with amount snapshot. | Composite PK `(payout_id, commission_id)`; commission unique; both FKs restrict deletion; RLS server-only. |
| `affiliate_fraud_flags` | Affiliate/order/click risk findings and resolution. | FKs to affiliate, optional order/click/resolver; partial unresolved-risk index; RLS server-only. |
| `affiliate_materials` | Partner marketing assets and copy. | Nullable creator profile FK; approved affiliates can read active rows via `auth.uid()`. |
| `affiliate_email_events` | Idempotent affiliate email delivery log. | Text `event_key` PK; nullable affiliate FK; RLS server-only. |
| `affiliate_attributions` | Attribution snapshot with expiry and optional conversion, campaign and business lead. | FKs to affiliate/campaign/business lead; unique nullable `converted_order_id -> orders`; affiliate/created index; RLS server-only. |
| `affiliate_coupons` | One coupon configuration per affiliate. | Unique affiliate FK; case-insensitive unique code index; RLS server-only. |
| `affiliate_commission_adjustments` | Auditable credit/debit/refund/recovery adjustments. | FKs to commission and creator profile, both restrict; commission/created index; RLS server-only. |
| `affiliate_tier_history` | Affiliate tier transitions and approval provenance. | FKs to affiliate, prior/new tier, and approver profile; RLS server-only. |
| `affiliate_business_leads` | Consent-based business lead, deduplication hashes, product, protection and order conversion. | FKs to affiliate, optional product/reviewer/order; unique linked order; affiliate/status and duplicate-detection indexes; own-read via `auth.uid()`. |
| `affiliate_reward_definitions` | Delivered-order reward thresholds. | Unique `name`; active-definition read policy; four defaults are seeded. |
| `affiliate_rewards` | Affiliate reward eligibility/review/fulfillment. | FKs to affiliate, definition and reviewer; unique `(affiliate_id, reward_definition_id)`; own-read via `auth.uid()`. |
| `affiliate_store_credits` | Affiliate credit balance entries, source/usage orders and expiry/reversal state. | FKs to affiliate and source/used orders; unique `(affiliate_id, order_id)`; balance index; own-read via `auth.uid()`. |

The final `request_affiliate_payout(uuid,text)` function locks approved commissions, validates currency/minimum/method, inserts the payout and payout items, and changes commissions to `RESERVED_FOR_PAYOUT`. It is Supabase-role-specific only in its `REVOKE`/`GRANT` to `anon`, `authenticated`, and `service_role`; its transactional business logic should be retained in adapted form.

### Cards, analytics, support, and storage

| Table/object | Purpose and important columns | Keys, indexes, policies, and dependencies |
|---|---|---|
| `digital_cards` | User-owned card slug, profile/design JSON, publication, activation hash and validity. | Unique `slug`; `owner_id -> profiles` cascade; owner index; owner CRUD policies use `auth.uid()`. |
| `card_events` | Card analytics: view/contact/link/share/lead events, channel, link type and visitor hash. | Bigint identity PK; `card_id -> digital_cards` cascade; card/time and card/type indexes; owner read through card and `auth.uid()`. |
| `card_leads` | Consent-based contact lead attached to a card. | `card_id -> digital_cards` cascade; card/time index; owner read through card and `auth.uid()`. |
| `support_tickets` | Public support request, reference, contact/message, assignment and workflow state. | Unique `reference`; nullable `assigned_to -> profiles`; status/time and fingerprint/time indexes; RLS server-only. |
| `support_ticket_replies` | Admin reply and email delivery record. | `ticket_id -> support_tickets` cascade; nullable `author_id -> profiles`; ticket/time index; RLS server-only. |
| `storage.buckets` / `storage.objects` | Supabase `card-media` public bucket, 5 MiB MIME allowlist and public-read policy. | Supabase Storage infrastructure, not a `public` application table. It must not be imported blindly into plain PostgreSQL; media objects and object metadata require a separate storage migration decision. |

There is no general analytics/events table beyond `card_events`, `affiliate_clicks`, `affiliate_visitors`, affiliate attribution records, and the administrative audit log.

## PostgreSQL types and extension

The migrations require `pgcrypto` for `gen_random_uuid()`. They define these public enums: `app_role`, `account_status`, `product_type`, `order_status`, `payment_status`, `affiliate_status`, `affiliate_commission_status` (later extended with `RESERVED_FOR_PAYOUT`), `affiliate_payout_status`, `affiliate_risk`, `affiliate_rate_type`, `partner_type`, `affiliate_lead_status`, `affiliate_reward_status`, and `store_credit_status`.

No other PostgreSQL extension is declared. Before any target migration, verify whether PostgreSQL 18 already supplies `gen_random_uuid()` and whether retaining `pgcrypto` is still desired; enabling an extension is a schema change and requires explicit approval.

## Supabase-specific dependencies

### Authentication and UUID identity

- `public.profiles.id` directly references `auth.users.id`; this is the sole direct public-to-`auth.users` FK.
- `handle_new_auth_user`, triggered after insert on `auth.users`, creates the profile using `new.id`, normalized email, and `raw_user_meta_data->>'name'`.
- The foundation migration backfills profiles from every existing `auth.users` row.
- All downstream user ownership is therefore transitive through `profiles.id`: orders (`customer_id`), cards (`owner_id`), affiliate user/application IDs, admin actor/inviter/approver/reviewer/creator IDs, settings updater, and support assignee/author.
- Application identity comparisons assume UUID-shaped IDs; card APIs explicitly recognize a 36-character UUID form, and every identity FK is `uuid`.
- Preserving old auth-user UUIDs is mandatory if any customer/business data exists. Re-keying would require a high-risk rewrite across many tables and logs and offers no benefit.

### Supabase Auth APIs

Current password signup/login/logout/recovery/reset/change-password routes call `/auth/v1/*`. Identity resolution calls `/auth/v1/user`. Google Auth.js currently creates a Supabase auth user through `/auth/v1/admin/users`, then relies on the auth-user trigger/profile lookup. Thus the partial Auth.js code is not yet independent of Supabase.

Auth.js currently uses JWT sessions, so the repository does not yet require database `accounts` or `sessions` tables. Those are proposed target objects, not objects to reconstruct from these migrations.

### PostgREST

`src/lib/supabaseAuth.ts` implements generic calls to `${SUPABASE_URL}/rest/v1/...` using anon or service-role bearer keys. Repository code directly addresses 33 of the 36 public tables through PostgREST; `affiliate_attributions`, `affiliate_coupons`, and `affiliate_tier_history` are schema-defined but have no direct table endpoint reference in the current source. Calls use filters, ordering, count/range headers, nested resource embedding/FK hints, conflict upserts, and `/rest/v1/rpc/request_affiliate_payout`. `src/middleware.ts` also writes affiliate visitors/clicks directly through PostgREST. A plain Coolify PostgreSQL connection cannot satisfy these HTTP calls; they must eventually be replaced by server-side SQL/repository functions or an explicitly chosen API layer. That application rewrite is outside this recovery phase.

### RLS and Supabase roles

Policies using `auth.uid()` protect profiles, customer orders/items, affiliate-owned data, and digital cards/events/leads. Plain PostgreSQL has no Supabase `auth.uid()` unless it is recreated, which is not recommended for the target architecture. Server-side authorization should be enforced by authenticated application queries/transactions, with database roles and optional target-native RLS designed explicitly rather than copying these policies unchanged.

`protect_profile_security_fields` also depends on `auth.jwt()` and Supabase role names/current users (`service_role`, `supabase_admin`). Rewrite it for the target trust model; do not carry it unchanged. Grants to `anon`, `authenticated`, and `service_role`, and the service-role RLS bypass assumption, are likewise Supabase-specific.

### Storage

The `card-media` bucket creation and `storage.objects` policy depend on Supabase Storage schemas and services. Do not import the Supabase `storage` schema into Coolify merely to satisfy this migration. Export original media objects plus their paths/content types separately and select target object storage before changing application behavior.

## Password and external identity strategy

Supabase Auth commonly stores password verifiers in `auth.users.encrypted_password`, but actual availability, algorithm/cost parameters, and target verifier compatibility must be established from an authorized database export and a non-secret metadata inspection. Never print or place hashes in logs, documentation, source control, CSV, or command history.

If compatible, copy each verifier through an encrypted, access-controlled database-to-database process into a restricted credential column associated one-to-one with the same canonical UUID. Validate compatibility using a purpose-created test credential, not a real customer's hash. Force no password change solely because of migration unless policy requires it.

If hashes are unavailable or incompatible, create no passwords. Preserve the user/profile UUID and verification state, mark the password credential as requiring secure reset/enrollment, revoke old sessions, and use a single-use, expiring, rate-limited reset flow after the target authentication system is ready. Do not email resets before deployment readiness and explicit approval.

Export `auth.identities` to distinguish email/password and Google identities. Map a Google identity to the canonical user only when its `user_id` relationship or verified-email evidence is authoritative. Do not merge users on an unverified email. Preserve provider subject identifiers in a future `accounts` table while keeping the existing UUID as canonical user ID.

## Target identity model (design, not migration SQL)

Use one canonical `users.id uuid` and preserve each existing `auth.users.id`. Keep business/profile fields in `profiles`, keyed one-to-one to `users.id`. Put password-verifier state in a tightly restricted credential structure (either on `users` or a dedicated credentials table), provider identities in `accounts`, and only create `sessions` if the selected Auth.js strategy uses database sessions. Do not create duplicate user rows for Google and password login methods.

Before finalizing this model, inventory actual old-auth columns and identity providers, choose JWT versus database sessions, define email uniqueness/case normalization, verification semantics, session revocation, and the database/application authorization boundary. No `SUPER_ADMIN` should be created until this model, authentication, profiles, roles, authorization, and migration validation all work.

## Path 1 — old Supabase database available (preferred)

1. Freeze the migration design and obtain authorized read-only access or a Supabase-produced logical backup. Do not connect from this repository without explicit approval.
2. Record the Supabase project reference, PostgreSQL version, applied migration history, enabled extensions, table/sequence counts, and storage object inventory. Take a dated full backup before any extraction.
3. Prefer an encrypted custom-format `pg_dump` from the Supabase dashboard/direct database connection. Capture schema and data for the required public tables, and separately capture only the necessary identity data from `auth.users` and `auth.identities`. Also export media objects through Supabase Storage tooling. Do not rely on frontend scraping or PostgREST pagination for the authoritative backup.
4. Restore the dump into an isolated, access-controlled staging PostgreSQL instance—not Coolify production. Never restore Supabase-owned `auth`, `storage`, realtime, extensions, or platform roles wholesale into the target.
5. Reconcile the live source schema against all six repository migrations. The live database is authoritative for data and may contain drift; document every extra/missing column, constraint, enum value, function, trigger, policy, and applied migration.
6. Build target-native identity tables in staging. Insert canonical users first with the exact source UUID, normalized email, timestamps, verification state, and compatible credential/provider mappings. Then insert profiles using the same UUID.
7. Create target business schema in dependency order below, using adapted migration SQL that omits Supabase roles/APIs/storage and rewrites identity FKs to the canonical `users`/`profiles` model.
8. Import data in dependency order with triggers and application side effects disabled or omitted during load. Preserve UUIDs, bigint identity values, timestamps, order numbers, monetary minor units, snapshots, and ciphertext exactly. Reset bigint sequences/identity state afterward.
9. Validate row counts and deterministic checksums per table, orphan queries for every FK, unique/check constraints, enum values, aggregate order/payment/commission totals, card ownership, affiliate balances/payout reservations, identity/profile/provider coverage, and sampled relational reads. Do not expose customer fields in reports.
10. Rehearse rollback and repeat the staging migration from a fresh backup. Only then prepare a production cutover plan with maintenance window, final delta/freeze, transaction boundaries, backup, smoke tests, and rollback gates for separate approval.

### Target table creation order

Create types/extension first, then tables in these dependency groups:

1. Canonical `users` (and selected credential/provider/session tables).
2. `profiles`.
3. Independent/reference roots: `products`, `affiliate_tiers`, `affiliate_settings`, `affiliate_reward_definitions`, `website_settings`.
4. Commerce/admin roots: `orders` initially without the circular `affiliate_lead_id` FK, `order_items`, `payments`, `admin_audit_logs`, `admin_notifications`, `admin_invites`.
5. Affiliate roots: `affiliate_profiles`, `affiliate_applications`, `affiliate_product_rates`, `affiliate_campaigns`, `affiliate_visitors`, `affiliate_clicks`.
6. Affiliate transaction tables: `affiliate_commissions`, `affiliate_payouts`, `affiliate_payout_items`, `affiliate_fraud_flags`, `affiliate_materials`, `affiliate_email_events`, `affiliate_coupons`, `affiliate_commission_adjustments`, `affiliate_tier_history`.
7. Lead/reward/credit tables: `affiliate_business_leads`, `affiliate_attributions`, `affiliate_rewards`, `affiliate_store_credits`; then add `orders.affiliate_lead_id -> affiliate_business_leads` to resolve the order/lead cycle.
8. Cards: `digital_cards`, `card_events`, `card_leads`.
9. Support: `support_tickets`, `support_ticket_replies`.
10. Adapted target-native functions/triggers, indexes, constraints and authorization controls after data loading/validation where safe.

### Data import order

Use the same dependency order, but import users before profiles and retain source primary keys. Import singleton/reference data before dependent transactions. Import orders before order items/payments/commissions; affiliate profiles/campaigns before order affiliate FKs are validated; payouts before payout items; cards before events/leads; tickets before replies. Handle the order/business-lead circular relationship in two passes: import both with the circular columns nullable/unvalidated, populate IDs, then validate both FKs.

## Path 2 — old Supabase database unavailable

Do not start this path merely because current Coolify is empty. First obtain explicit confirmation that no Supabase database backup, paused project restore, PITR, logical export, organization backup, or storage export is recoverable.

If confirmed unavailable:

1. Preserve all evidence and configuration references, then adapt the six migrations into a new target migration series. Do not edit historical migrations as though they had run on Coolify.
2. Create the canonical identity design first, then translate `profiles.id -> auth.users.id` to the target user FK; omit `handle_new_auth_user` and replace it with application-controlled transactional provisioning.
3. Replace `auth.uid()`/`auth.jwt()` RLS, Supabase role grants, service-role assumptions, and Storage SQL. Retain business checks, keys, indexes and the adapted payout/low-stock logic after review.
4. Apply only to an isolated staging database, test from an empty database, validate schema, then propose a separately approved production migration.
5. Seed only repository-defined non-user reference/singleton rows. Do not invent customers, admins, orders, cards, affiliates, payments, events, support records, or audit history.

Without the old database/backup, repository migrations can reconstruct structure and the four documented reference/singleton datasets, but cannot recover real users, password hashes, provider identities, UUID relationships, profiles, orders, cards, payments, affiliates, support content, audit logs, analytics, or media objects. Frontend/local browser state is not an authoritative substitute.

## Objects not to carry over unchanged

- Supabase-owned `auth`, `storage`, realtime, platform migration, vault, GraphQL/PostgREST, and internal extension schemas.
- The `on_auth_user_created` trigger and `handle_new_auth_user` function.
- `auth.uid()` and `auth.jwt()` RLS expressions.
- Grants/revokes for `anon`, `authenticated`, `service_role`, and checks for `supabase_admin`.
- `storage.buckets` insert and `storage.objects` policy until target object storage is chosen.
- Supabase migration bookkeeping as target application migrations.

Retain only after adaptation/review: `protect_profile_security_fields` intent, `request_affiliate_payout` atomicity/locking, `notify_low_stock` idempotence, business checks/enums, keys, indexes, and audit provenance.

## Current Coolify gap

Confirmed absent in production: Supabase `auth` schema, `auth.users`, `auth.identities`, `public.profiles`, its role schema, password column/hash evidence, and its auth-user FK. The audit's Case C result says important application data tables are missing. Given the migration was not applied, the expected gap is all 36 public tables, public enums/functions/triggers/policies/indexes, reference rows, and Supabase Storage objects listed above. Before migration, run a separately approved read-only full catalog inventory to prove exact absence and detect any unrelated/partially created objects; do not infer that an existing `public` schema is empty.

## Information required from the user / Supabase

Provide or confirm the following without pasting secrets into chat or committing them:

1. Supabase project reference/organization and whether the project is active, paused, deleted, or restorable.
2. Dashboard access level and availability/retention dates of automatic backups, PITR, or downloadable logical backups.
3. An encrypted custom-format PostgreSQL dump produced via an approved secure channel, or authorization and a time-limited read-only database connection. Include checksum, creation time, source PostgreSQL version, and dump-tool version.
4. Whether the dump includes `public`, `auth.users`, `auth.identities`, migration history, and large objects; obtain schema-only and data sections if Supabase splits them.
5. A table row-count report and applied-migrations list from the old project. Reports should contain counts/object names only, not emails, names, hashes, tokens, or customer rows.
6. Auth provider configuration inventory: email/password enabled, Google enabled, email-confirmation rules, and any other providers. Provider client secrets are not needed for database planning.
7. Confirmation whether password hashes may be exported under the organization's security policy, and the documented hash algorithm/parameters. Do not send hashes in chat.
8. Supabase Storage `card-media` object inventory/export and the intended future object-storage provider.
9. The last known application write time, acceptable maintenance window, and whether production writes can be frozen for final cutover.
10. Any schema changes made manually in the Supabase SQL Editor after these six migrations.

Existing repository configuration contains only references through the variable names `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; their values were not inspected or printed. Their presence can identify the integration shape but cannot establish that the old project or its data is recoverable.

## Recommended next action

Choose Path 1 discovery: in the old Supabase dashboard, determine project/backup availability and obtain a dated, encrypted logical backup plus safe object/count metadata. Do not run anything against Coolify and do not start Path 2. Once the backup exists, restore it to an isolated staging database and produce a live-schema-versus-repository drift report before writing target migration SQL.

Only after that report should the canonical user/auth schema and adapted PostgreSQL migrations be finalized. `SUPER_ADMIN` creation remains a later, separately authorized post-migration step.
