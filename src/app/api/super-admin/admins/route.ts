import { NextResponse } from "next/server";
import { requireSuperAdmin, validMutationOrigin, audit, safeError } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { findUserById } from "@/lib/repositories/users";

export async function GET() {
  try {
    const superAdmin = await requireSuperAdmin();
    if (!superAdmin) {
      return NextResponse.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
    }

    const usersResult = await pool.query(
      `select id, email, name, role, status, disabled, created_by_admin_id, created_at, updated_at from users order by created_at desc`
    );

    const auditLogsResult = await pool.query(
      `select id, actor_id, actor_role, action, entity_type, entity_id, before_summary, after_summary, ip_address, created_at
       from admin_audit_logs order by created_at desc limit 100`
    );

    return NextResponse.json({
      users: usersResult.rows,
      auditLogs: auditLogsResult.rows,
    });
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
    }

    const superAdmin = await requireSuperAdmin();
    if (!superAdmin) {
      return NextResponse.json({ message: "Forbidden: Super Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const { userId, newRole, status } = body;

    if (!userId || !newRole) {
      return NextResponse.json({ message: "userId and newRole are required." }, { status: 400 });
    }

    if (!["ADMIN", "USER", "CUSTOMER"].includes(newRole)) {
      return NextResponse.json({ message: "Invalid role specified." }, { status: 400 });
    }

    const targetUser = await findUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: "Target user not found." }, { status: 404 });
    }

    if (targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json({ message: "Cannot modify SUPER_ADMIN role." }, { status: 403 });
    }

    const updatedStatus = status || targetUser.status;
    const disabled = updatedStatus === "DISABLED" || updatedStatus === "SUSPENDED";

    await pool.query(`update users set role=$1, status=$2, disabled=$3, updated_at=now() where id=$4`, [
      newRole,
      updatedStatus,
      disabled,
      userId,
    ]);

    const updatedUser = await findUserById(userId);

    await audit(superAdmin, "ADMIN_ROLE_CHANGED", "users", userId, { role: targetUser.role, status: targetUser.status }, { role: newRole, status: updatedStatus });

    return NextResponse.json({ message: "User role updated successfully", user: updatedUser });
  } catch (error) {
    return safeError(error);
  }
}
