import { NextRequest, NextResponse } from "next/server";

const REF_COOKIE = "mlc_affiliate_ref";
const VISITOR_COOKIE = "mlc_affiliate_visitor";

export async function middleware(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9][A-Z0-9_-]{5,11}$/.test(code)) return NextResponse.next();
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signingSecret = process.env.AFFILIATE_COOKIE_SECRET || serviceKey;
  if (!supabaseUrl || !serviceKey || !signingSecret) return NextResponse.next();

  try {
    const affiliateResponse = await fetch(
      `${supabaseUrl}/rest/v1/affiliate_profiles?affiliate_code=eq.${encodeURIComponent(code)}&status=eq.APPROVED&select=id,partner_type&limit=1`,
      { headers: serviceHeaders(serviceKey), cache: "no-store" },
    );
    const affiliate = (await affiliateResponse.json())?.[0];
    if (!affiliate) return NextResponse.next();
    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/affiliate_settings?id=eq.true&select=attribution_window_days,business_lead_protection_days,program_enabled&limit=1`,
      { headers: serviceHeaders(serviceKey), cache: "no-store" },
    );
    const settings = (await settingsResponse.json())?.[0];
    if (settings?.program_enabled === false) return NextResponse.next();
    const days = Math.min(365, Math.max(1, affiliate.partner_type === "BUSINESS_PARTNER"
      ? Number(settings?.business_lead_protection_days) || 90
      : Number(settings?.attribution_window_days) || 30));
    const campaign = sanitizeLabel(request.nextUrl.searchParams.get("campaign"));
    const source = sanitizeLabel(request.nextUrl.searchParams.get("source"));
    let campaignId: string | null = null;
    if (campaign) {
      const campaignResponse = await fetch(
        `${supabaseUrl}/rest/v1/affiliate_campaigns?affiliate_id=eq.${affiliate.id}&name=eq.${encodeURIComponent(campaign)}&active=eq.true&select=id&limit=1`,
        { headers: serviceHeaders(serviceKey), cache: "no-store" },
      );
      campaignId = (await campaignResponse.json().catch(() => []))?.[0]?.id || null;
      if (!campaignId) return NextResponse.next();
    }
    const now = Date.now();
    const payload = { affiliateId: affiliate.id, ...(campaign ? { campaign } : {}), ...(source ? { source } : {}), issuedAt: now, expiresAt: now + days * 86_400_000 };
    const response = NextResponse.next();
    response.cookies.set(REF_COOKIE, await signPayload(payload, signingSecret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: days * 86_400,
    });

    const visitorId = request.cookies.get(VISITOR_COOKIE)?.value || crypto.randomUUID();
    if (!request.cookies.has(VISITOR_COOKIE)) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 86_400,
      });
    }
    const visitorHash = await sha256(`${signingSecret}:${visitorId}`);
    const visitorInsert = await fetch(`${supabaseUrl}/rest/v1/affiliate_visitors?on_conflict=affiliate_id,visitor_hash`, {
      method: "POST",
      headers: { ...serviceHeaders(serviceKey), Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ affiliate_id: affiliate.id, visitor_hash: visitorHash }),
    });
    const createdVisitor = visitorInsert.ok && ((await visitorInsert.json().catch(() => [])) as unknown[]).length > 0;
    const referrer = request.headers.get("referer");
    let referrerHost: string | null = null;
    try { referrerHost = referrer ? new URL(referrer).hostname.slice(0, 255) : null; } catch { /* invalid referer is ignored */ }
    await fetch(`${supabaseUrl}/rest/v1/affiliate_clicks`, {
      method: "POST",
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({
        affiliate_id: affiliate.id,
        campaign_id: campaignId,
        visitor_hash: visitorHash,
        is_unique: createdVisitor,
        destination_path: `${request.nextUrl.pathname}${request.nextUrl.search}`.slice(0, 1000),
        campaign,
        source,
        referrer_host: referrerHost,
      }),
    });
    return response;
  } catch {
    // Tracking must never make the storefront unavailable.
    return NextResponse.next();
  }
}

function sanitizeLabel(value: string | null) {
  const clean = value?.trim().replace(/[^a-zA-Z0-9 _.-]/g, "").slice(0, 80);
  return clean || null;
}

function serviceHeaders(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function signPayload(payload: object, secret: string) {
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return `${encoded}.${base64url(new Uint8Array(signature))}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)"],
};
