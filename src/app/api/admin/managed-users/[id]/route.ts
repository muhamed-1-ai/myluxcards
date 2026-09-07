import { NextResponse } from "next/server";
import { requireManagedUserOwnership, validMutationOrigin, audit, safeError } from "@/lib/adminAuth";
import { updateUserPermissions, updateUserStatus, updateUserNickname } from "@/lib/repositories/users";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const authResult = await requireManagedUserOwnership(params.id);
    if (!authResult) {
      return NextResponse.json({ message: "Forbidden or user not found" }, { status: 403 });
    }

    return NextResponse.json({ user: authResult.managedUser });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
    }

    const params = await props.params;
    const authResult = await requireManagedUserOwnership(params.id);
    if (!authResult) {
      return NextResponse.json({ message: "Forbidden or user not found" }, { status: 403 });
    }

    const { identity, managedUser } = authResult;
    const body = await request.json();
    const { name, status, featurePermissions } = body;

    let updatedUser = managedUser;

    if (name && typeof name === "string") {
      updatedUser = await updateUserNickname(managedUser.id, name);
    }

    if (status && typeof status === "string" && ["ACTIVE", "PENDING_PAYMENT", "SUSPENDED", "DISABLED"].includes(status)) {
      const oldStatus = managedUser.status;
      updatedUser = await updateUserStatus(managedUser.id, status);
      const actionName = status === "SUSPENDED" ? "USER_SUSPENDED" : status === "ACTIVE" ? "USER_ACTIVATED" : "USER_STATUS_CHANGED";
      await audit(identity, actionName, "users", managedUser.id, { status: oldStatus }, { status });
    }

    if (featurePermissions && typeof featurePermissions === "object") {
      const oldPermissions = managedUser.feature_permissions;
      updatedUser = await updateUserPermissions(managedUser.id, featurePermissions);
      await audit(identity, "USER_PERMISSION_CHANGED", "users", managedUser.id, { permissions: oldPermissions }, { permissions: featurePermissions });
    }

    await audit(identity, "USER_UPDATED", "users", managedUser.id, managedUser, updatedUser);

    return NextResponse.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    return safeError(error);
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
    }

    const params = await props.params;
    const authResult = await requireManagedUserOwnership(params.id);
    if (!authResult) {
      return NextResponse.json({ message: "Forbidden or user not found" }, { status: 403 });
    }

    const { identity, managedUser } = authResult;
    const updatedUser = await updateUserStatus(managedUser.id, "DISABLED");

    await audit(identity, "USER_DISABLED", "users", managedUser.id, { status: managedUser.status }, { status: "DISABLED" });

    return NextResponse.json({ message: "User account disabled successfully", user: updatedUser });
  } catch (error) {
    return safeError(error);
  }
}
