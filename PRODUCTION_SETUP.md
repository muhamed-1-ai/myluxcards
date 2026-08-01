# Production setup

## Supabase

Run `supabase/migrations/202608010001_card_media_support.sql` in the production Supabase SQL Editor before using cloud media uploads or Admin support-ticket management. The migration creates the `card-media` bucket, support tables, row-level security, and low-stock notifications.

## Razorpay

Add these Production environment variables in Vercel:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Create a Razorpay webhook for `https://myluxcards.vercel.app/api/payments/razorpay/webhook` and subscribe to `payment.captured` and `payment.failed`. Until credentials are present, online checkout returns a clear unavailable message; cash on delivery remains available.

## Email

Set `RESEND_API_KEY`, `EMAIL_FROM`, `SUPER_ADMIN_NOTIFICATION_EMAIL`, and `APP_URL`. Order confirmations, status changes, support alerts, and support replies use these values. Email failure never marks a support reply as sent.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build` before every deployment.
