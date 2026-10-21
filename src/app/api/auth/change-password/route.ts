import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/auth/currentIdentity";
import { validMutationOrigin } from "@/lib/adminAuth";
import { changePasswordForAuthenticatedUser } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const user = await currentIdentity(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : typeof body.password === "string" ? body.password : "";

    const result = await changePasswordForAuthenticatedUser(user.id, currentPassword, newPassword);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        signInRequired: true,
        message: result.message,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, private" },
      }
    );

    // Expire session cookies so the browser also removes them immediately
    response.cookies.set("next-auth.session-token", "", { path: "/", maxAge: 0, expires: new Date(0) });
    response.cookies.set("__Secure-next-auth.session-token", "", { path: "/", maxAge: 0, expires: new Date(0), secure: true });

    return response;
  } catch (error) {
    console.error("[Auth][ChangePassword] Unexpected error:", error);
    return NextResponse.json(
      { message: "Unable to complete password change. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
