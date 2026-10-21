import { NextResponse } from "next/server";
import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { updateUserNickname } from "@/lib/repositories/users";
import { isAccountGoogleOnly, userHasLocalPassword } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const isGoogleOnly = await isAccountGoogleOnly(identity.id);
  const hasPassword = await userHasLocalPassword(identity.id);

  return NextResponse.json(
    {
      user: identity,
      id: identity.id,
      email: identity.email,
      name: identity.name,
      role: identity.role,
      status: identity.status,
      isGoogleOnly,
      hasPassword,
    },
    {
      headers: { "Cache-Control": "no-store, private" },
    }
  );
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body.nickname === "string" ? body.nickname : typeof body.name === "string" ? body.name : "";
    const nickname = rawName.trim();

    if (!nickname) {
      return NextResponse.json({ message: "Nickname cannot be empty." }, { status: 400 });
    }
    if (nickname.length < 2) {
      return NextResponse.json({ message: "Nickname must be at least 2 characters." }, { status: 400 });
    }
    if (nickname.length > 30) {
      return NextResponse.json({ message: "Nickname cannot exceed 30 characters." }, { status: 400 });
    }

    const updatedUser = await updateUserNickname(identity.id, nickname);
    if (!updatedUser) {
      return NextResponse.json({ message: "User profile not found or update failed." }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        disabled: updatedUser.disabled,
        mustChangePassword: updatedUser.must_change_password,
      },
      message: "Nickname updated successfully.",
    });
  } catch (error) {
    return safeError(error);
  }
}
