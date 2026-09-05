import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { updateUserNickname } from "@/lib/repositories/users";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ user: null }, { status: 200 });
  return Response.json({ user: identity });
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawName = typeof body.nickname === "string" ? body.nickname : typeof body.name === "string" ? body.name : "";
    const nickname = rawName.trim();

    if (!nickname) {
      return Response.json({ message: "Nickname cannot be empty." }, { status: 400 });
    }
    if (nickname.length < 2) {
      return Response.json({ message: "Nickname must be at least 2 characters." }, { status: 400 });
    }
    if (nickname.length > 30) {
      return Response.json({ message: "Nickname cannot exceed 30 characters." }, { status: 400 });
    }

    const updatedUser = await updateUserNickname(identity.id, nickname);
    if (!updatedUser) {
      return Response.json({ message: "User profile not found or update failed." }, { status: 404 });
    }

    return Response.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        disabled: updatedUser.disabled,
        mustChangePassword: updatedUser.must_change_password,
      },
      message: "Nickname updated successfully."
    });
  } catch (error) {
    return safeError(error);
  }
}

