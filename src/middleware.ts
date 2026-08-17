import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const REF_COOKIE = "mlc_affiliate_ref";
const VISITOR_COOKIE = "mlc_affiliate_visitor";

export async function middleware(request: NextRequest) {
  const accountRoute = isAccountRoute(request.nextUrl.pathname);
  const session = accountRoute
    ? await getToken({ req: request, secret: process.env.AUTH_SECRET, secureCookie: process.env.NODE_ENV === "production" })
    : null;
  if (accountRoute && !session?.userId) {
    const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const refreshUrl = new URL("/api/auth/refresh", request.url);
    refreshUrl.searchParams.set("next", destination);
    return NextResponse.redirect(refreshUrl);
  }

  const code = request.nextUrl.searchParams.get("ref")?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9][A-Z0-9_-]{5,11}$/.test(code)) return NextResponse.next();
  const signingSecret = process.env.AFFILIATE_COOKIE_SECRET || process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "default_secret";

  try {
    const visitorId = request.cookies.get(VISITOR_COOKIE)?.value || crypto.randomUUID();
    const visitorHash = await sha256(`${signingSecret}:${visitorId}`);
    const campaign = sanitizeLabel(request.nextUrl.searchParams.get("campaign"));
    const source = sanitizeLabel(request.nextUrl.searchParams.get("source"));
    const referrer = request.headers.get("referer");
    let referrerHost: string | null = null;
    try { referrerHost = referrer ? new URL(referrer).hostname.slice(0, 255) : null; } catch { /* invalid referer is ignored */ }

    const trackRes = await fetch(new URL("/api/affiliate/track", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        campaign,
        source,
        visitorHash,
        referrerHost,
        destinationPath: `${request.nextUrl.pathname}${request.nextUrl.search}`.slice(0, 1000),
      }),
      cache: "no-store",
    });

    if (!trackRes.ok) return NextResponse.next();
    const trackData = await trackRes.json().catch(() => null);
    if (!trackData?.ok || !trackData.affiliateId) return NextResponse.next();

    const days = Number(trackData.days) || 30;
    const now = Date.now();
    const payload = { affiliateId: trackData.affiliateId, ...(campaign ? { campaign } : {}), ...(source ? { source } : {}), issuedAt: now, expiresAt: now + days * 86_400_000 };
    const response = NextResponse.next();
    response.cookies.set(REF_COOKIE, await signPayload(payload, signingSecret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: days * 86_400,
    });

    if (!request.cookies.has(VISITOR_COOKIE)) {
      response.cookies.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 86_400,
      });
    }

    return response;
  } catch {
    // Tracking must never make the storefront unavailable.
    return NextResponse.next();
  }
}

function isAccountRoute(pathname: string) {
  return pathname === "/dashboard"
    || pathname === "/orders"
    || pathname === "/affiliate/apply"
    || pathname === "/partners/apply"
    || pathname === "/admin"
    || pathname.startsWith("/admin/");
}

function sanitizeLabel(value: string | null) {
  const clean = value?.trim().replace(/[^a-zA-Z0-9 _.-]/g, "").slice(0, 80);
  return clean || null;
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
