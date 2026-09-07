import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { linkGoogleIdentity } from "@/lib/authService";
import { validMutationOrigin } from "@/lib/adminAuth";

const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "myluxcards-auth-secret-session-key-2026";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID || "100033105320-vesgkflqqv9nermm0nllqa5mnnhq6kms.apps.googleusercontent.com";

interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  aud: string;
}

export async function POST(req: NextRequest) {
  if (!validMutationOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { credential } = body;

    if (!credential || typeof credential !== "string") {
      return NextResponse.json({ error: "Missing Google credential token" }, { status: 400 });
    }

    // Verify token with Google's OAuth2 tokeninfo endpoint
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      cache: "no-store",
    });

    if (!tokenInfoRes.ok) {
      return NextResponse.json({ error: "Invalid Google credential token" }, { status: 401 });
    }

    const payload: GoogleTokenPayload = await tokenInfoRes.json();

    // Verify token audience matches our Google Client ID
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      console.error("[OneTap] Audience mismatch:", payload.aud, "expected:", GOOGLE_CLIENT_ID);
      return NextResponse.json({ error: "Client ID mismatch" }, { status: 401 });
    }

    const isVerified = payload.email_verified === true || payload.email_verified === "true";
    if (!payload.email || !isVerified) {
      return NextResponse.json({ error: "Google email is not verified" }, { status: 401 });
    }

    // Link/create user account transactionally
    const user = await linkGoogleIdentity({
      providerAccountId: payload.sub,
      email: payload.email,
      name: payload.name || "",
      image: payload.picture || null,
    });

    // Create NextAuth JWT Session token
    const tokenPayload = {
      userId: user.id,
      sessionVersion: user.session_version,
      name: user.name,
      email: user.email,
      sub: user.id,
    };

    const sessionToken = await encode({
      token: tokenPayload,
      secret: AUTH_SECRET,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    const isProd = process.env.NODE_ENV === "production";
    const cookieName = isProd ? "__Secure-next-auth.session-token" : "next-auth.session-token";

    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProd,
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error("[OneTap] Google One Tap authentication error:", error);
    return NextResponse.json({ error: "Internal server authentication error" }, { status: 500 });
  }
}
