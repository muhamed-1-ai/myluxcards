import { NextResponse } from "next/server";
import { requireAdmin, validMutationOrigin, audit, safeError } from "@/lib/adminAuth";
import { createAdminManagedUser } from "@/lib/authService";
import { findManagedUsersByAdmin } from "@/lib/repositories/users";

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = admin.role === "SUPER_ADMIN";
    const users = await findManagedUsersByAdmin(admin.id, isSuperAdmin);

    return NextResponse.json({ users });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
    }

    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, password, status, featurePermissions } = body;

    if (!name || !email) {
      return NextResponse.json({ message: "Name and email are required." }, { status: 400 });
    }

    // Role is ALWAYS 'USER'. Client cannot supply 'ADMIN' or 'SUPER_ADMIN'.
    const newUser = await createAdminManagedUser({
      adminId: admin.id,
      name,
      email,
      password,
      status: status || "ACTIVE",
      featurePermissions,
    });

    await audit(admin, "USER_CREATED", "users", newUser.id, null, {
      email: newUser.email,
      name: newUser.name,
      createdByAdminId: admin.id,
      role: newUser.role,
      status: newUser.status,
    });

    return NextResponse.json({ message: "User created successfully", user: newUser }, { status: 201 });
  } catch (error: any) {
    if (error.message === "USER_EMAIL_EXISTS") {
      return NextResponse.json({ message: "A user with this email address already exists." }, { status: 409 });
    }
    if (error.message === "INVALID_MANAGED_USER_INPUT") {
      return NextResponse.json({ message: "Invalid name or email format." }, { status: 400 });
    }
    return safeError(error);
  }
}
