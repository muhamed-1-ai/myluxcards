# MyLuxCards Affiliate Program

The affiliate system uses the existing Next.js 15 App Router, Supabase Auth/Postgres, integer minor-unit money model, Resend integration, admin roles, audit log, and Vercel deployment.

## Current integration boundary

The repository currently has persistent `products`, `orders`, `order_items`, and `payments` tables plus administrative order management. It does not yet contain a customer cart, checkout API, payment-provider webhook, refund API, cloud-storage adapter, or persistent card-activation backend.

Affiliate application, approval, signed referral tracking, dashboards, campaigns, payout reservation, admin controls, CSV export, email idempotency, fraud flags, commission calculations, reversal on trusted order cancellation/refund, and scheduled approval are implemented. A future trusted checkout must call `resolveAffiliateAttribution()` before inserting an order and save its result into the order’s affiliate columns. A verified payment webhook or authorized order transition must call `syncCommissionForTrustedOrder(order.id)`. Never invoke it based on a browser “payment succeeded” message.

## Database

Apply migrations in order:

```sh
supabase db push
```

Do not use `db reset` against an existing environment. The affiliate migration adds:

- `affiliate_profiles`
- `affiliate_applications`
- `affiliate_tiers`
- `affiliate_settings`
- `affiliate_product_rates`
- `affiliate_campaigns`
- `affiliate_visitors`
- `affiliate_clicks`
- affiliate-attribution columns on `orders`
- `affiliate_commissions`
- `affiliate_payouts`
- `affiliate_payout_items`
- `affiliate_fraud_flags`
- `affiliate_materials`
- `affiliate_email_events`
- `request_affiliate_payout()` transaction function

All money is stored as integer minor units, consistent with existing orders and payments. Rates expressed as percentages use basis points: `1000` means 10%.

## Environment variables

Configure these server-side in Vercel. None should use a `NEXT_PUBLIC_` prefix:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_NOTIFICATION_EMAIL`
- `AFFILIATE_COOKIE_SECRET` — at least 32 random bytes
- `AFFILIATE_PAYOUT_ENCRYPTION_KEY` — a separate strong secret
- `CRON_SECRET` — a separate strong secret used automatically by Vercel Cron
- `AFFILIATE_CRON_SECRET` — optional override for non-Vercel schedulers

## Operator flow

1. A signed-in customer opens `/affiliate/apply` and submits the application.
2. An ADMIN or SUPER_ADMIN opens `/admin/affiliates`.
3. The administrator reviews the record and approves it. Approval generates a collision-checked code.
4. The affiliate opens `/affiliate/dashboard` and copies the base link or creates product/campaign links.
5. A request containing a valid `ref` is validated on the server. The middleware records a privacy-conscious visitor hash and click, then sets an HttpOnly, signed, SameSite=Lax referral cookie for the configured window.
6. Trusted checkout code resolves coupon/cookie priority through `resolveAffiliateAttribution()`.
7. After persisted payment status is `SUCCEEDED`, `syncCommissionForTrustedOrder()` calculates a commission from trusted order fields. Self-referrals are rejected and flagged by default.
8. A delivered order’s pending commission becomes approved after the holding period through the protected daily cron.
9. The affiliate requests a payout. A database transaction reserves each approved commission exactly once.
10. An administrator reviews the payout and marks it paid with a transaction reference. Only then are its commissions marked `PAID`.

Cancelled/refunded orders reverse unpaid commissions. A real payment/refund webhook must call the same synchronization function after persisting the trusted provider state.

## Attribution

The default policy is last valid click with a 30-day cookie. Coupon attribution takes priority over the referral cookie. The cookie contains only an affiliate UUID, optional sanitized campaign/source, and timestamps; it is HMAC-signed and never trusted without checking the current affiliate status.

Campaign destinations must be local paths. External redirect targets are rejected.

## Vercel deployment

1. Apply the Supabase migrations to the target project.
2. Add all variables above in Vercel Project Settings.
3. Ensure `APP_URL` is the canonical HTTPS production origin.
4. Deploy the repository.
5. Confirm the cron appears under Vercel Project → Cron Jobs.
6. Submit and approve a test affiliate.
7. Visit `/?ref=TEST_CODE`, then confirm click and unique-visitor metrics.
8. Integrate `resolveAffiliateAttribution()` into the future trusted checkout before enabling public commission promises.
9. Run a low-value end-to-end payment/refund test after a payment provider is added.

## Security and privacy

- Every affiliate/admin mutation validates same-origin requests and server-side identity.
- Admin operations use authenticated role checks, not display names.
- Affiliates receive only their own records and privacy-masked customer identification.
- Payout details use AES-256-GCM ciphertext and are never returned by general APIs.
- Email sends have database and Resend idempotency keys.
- Financial state comes from persisted database records, never frontend totals.
- Vercel local filesystem is not used.

Program terms at `/affiliate/terms` are an editable operational template, not legal advice.
