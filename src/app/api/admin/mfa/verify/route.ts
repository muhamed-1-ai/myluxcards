import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { checkRateLimit } from "@/lib/authService";
import { getTrustedClientIp } from "@/lib/rateLimit";
import {
  verifyAdminMfaCodeOrRecovery,
  signAdminMfaToken,
  getRequestSessionToken,
  ADMIN_MFA_COOKIE_NAME,
} from "@/lib/auth/adminMfa";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Forbidden: Admin access required." }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();

    if (!code) {
      return NextResponse.json({ message: "Verification code is required." }, { status: 400 });
    }

    // Rate limit MFA verification attempts per admin user and per client IP
    const clientIp = getTrustedClientIp(request);
    const userAllowed = await checkRateLimit("MFA_VERIFY_USER", identity.id, 5, 900);
    const ipAllowed = await checkRateLimit("MFA_VERIFY_IP", clientIp, 20, 900);
    if (!userAllowed || !ipAllowed) {
      return NextResponse.json(
        { message: "Too many MFA attempts. Please wait 15 minutes before trying again." },
        { status: 429 }
      );
    }

    const result = await verifyAdminMfaCodeOrRecovery(identity.id, code);
    if (!result.success) {
      return NextResponse.json({ message: result.message || "Invalid verification code." }, { status: 401 });
    }

    const isProd = process.env.NODE_ENV === "production";
    const sessionToken = await getRequestSessionToken(request);
    const mfaCookieToken = signAdminMfaToken({
      userId: identity.id,
      role: identity.role,
      sessionVersion: identity.sessionVersion,
      sessionToken: sessionToken || undefined,
    });

    const response = NextResponse.json({
      ok: true,
      isRecovery: result.isRecovery ?? false,
      message: "Admin MFA verification successful.",
    });

    const maxAgeSeconds = 60 * 60 * 12; // 12 hours
    response.cookies.set(ADMIN_MFA_COOKIE_NAME, mfaCookieToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
      expires: new Date(Date.now() + maxAgeSeconds * 1000),
    });

    return response;
  } catch (error) {
    console.error("[Admin MFA Verify Error]:", error);
    return NextResponse.json({ message: "An error occurred during verification." }, { status: 500 });
  }
}
