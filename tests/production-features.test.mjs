import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checkout = readFileSync("src/app/api/checkout/route.ts", "utf8");
const verify = readFileSync("src/app/api/payments/razorpay/verify/route.ts", "utf8");
const webhook = readFileSync("src/app/api/payments/razorpay/webhook/route.ts", "utf8");
const media = readFileSync("src/app/api/media/route.ts", "utf8");
const orders = readFileSync("src/app/api/orders/route.ts", "utf8");
const invoice = readFileSync("src/app/api/orders/[id]/invoice/route.ts", "utf8");
const adminSupport = readFileSync("src/app/api/admin/support/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/202608010001_card_media_support.sql", "utf8");

test("Razorpay is created server-side and confirmed only after signatures verify", () => {
  assert.match(checkout, /createRazorpayOrder/);
  assert.match(verify, /verifyRazorpaySignature/);
  assert.match(webhook, /verifyRazorpayWebhook/);
  assert.match(verify, /customer_id=eq\.\$\{identity\.id\}/);
  assert.match(verify, /payment_status: "SUCCEEDED"/);
});

test("media uploads require identity, origin, allowlisted MIME types, and size limits", () => {
  assert.match(media, /validMutationOrigin\(request\)/);
  assert.match(media, /currentIdentity\(\)/);
  assert.match(media, /application\/pdf/);
  assert.match(media, /5 \* 1024 \* 1024/);
  assert.match(media, /matchesSignature/);
  assert.match(migration, /allowed_mime_types/);
});

test("orders and invoices are scoped to the signed-in customer", () => {
  assert.match(orders, /customer_id=eq\.\$\{identity\.id\}/);
  assert.match(invoice, /customer_id=eq\.\$\{identity\.id\}/);
  assert.match(invoice, /Cache-Control.*private, no-store/);
});

test("support replies require an admin and preserve an audit record", () => {
  assert.match(adminSupport, /requireAdmin\(\)/);
  assert.match(adminSupport, /validMutationOrigin\(request\)/);
  assert.match(adminSupport, /SUPPORT_TICKET_UPDATED/);
  assert.match(migration, /support_ticket_replies/);
});

test("support replies remain recorded when outbound email is unavailable", () => {
  assert.match(adminSupport, /const replyAt = new Date\(\)\.toISOString\(\)/);
  assert.match(adminSupport, /changes\.last_reply_at = replyAt/);
  assert.doesNotMatch(adminSupport, /Email delivery is not configured.*status:503/);
});
