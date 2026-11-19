import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import {
  confirmMfaEnrollment,
  getAdminMfaStatus,
  isSessionMfaVerified,
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

  // Re-enrollment guard: Prevent overwriting an already-enrolled admin unless the current session is verified
  const currentStatus = await getAdminMfaStatus(identity.id);
  if (currentStatus.enrolled) {
    const isVerified = await isSessionMfaVerified(identity, request);
    if (!isVerified) {
      return NextResponse.json(
        { message: "Admin MFA is already configured. Re-enrollment requires active MFA verification." },
        { status: 403 }
      );
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const secret = String(body.secret || "").trim();
    const token = String(body.token || "").trim();
    const recoveryCodes: string[] = Array.isArray(body.recoveryCodes) ? body.recoveryCodes : [];

    if (!secret || !token || recoveryCodes.length === 0) {
      return NextResponse.json({ message: "Secret, token, and recovery codes are required." }, { status: 400 });
    }

    const result = await confirmMfaEnrollment(identity.id, secret, recoveryCodes, token);
    if (!result.success) {
      return NextResponse.json({ message: result.message || "Invalid verification code." }, { status: 400 });
    }

    // Set signed MFA verification session cookie bound to the individual login session
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
      message: "Admin MFA successfully enrolled and verified.",
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
    console.error("[Admin MFA Confirm Error]:", error);
    return NextResponse.json({ message: "An error occurred while confirming MFA enrollment." }, { status: 500 });
  }
}
