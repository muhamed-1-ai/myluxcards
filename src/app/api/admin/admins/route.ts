import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { requireAuthoritativeOwner, isOwnerAccount } from "@/lib/ownerAuth";
import { pool, withTransaction } from "@/lib/db";

export async function GET() {
  const actor = await requireAdmin(true);
  if (!actor) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await pool.query<{
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
      disabled: boolean;
      created_at: string;
    }>(
      `SELECT id, email, name, role, status, disabled, created_at
       FROM users
       WHERE role IN ('ADMIN', 'SUPER_ADMIN')
       ORDER BY created_at DESC`
    );

    const data = result.rows.map((r) => ({
      ...r,
      isOwner: isOwnerAccount(r.id, r.email),
    }));

    return Response.json({ data });
  } catch (error) {
    return safeError(error);
  }
}

/**
 * Invitations are retired in favor of direct 1-click promotion of existing users in Admin -> Users.
 */
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  return Response.json(
    {
      ok: false,
      message: "Admin invitations have been retired. Please promote existing registered users directly from Admin → Users.",
    },
    { status: 400 }
  );
}

/**
 * Direct Administrator Promotion and Removal.
 * Strictly restricted to the authoritative primary owner account (muhammedfebincholayil@gmail.com).
 */
export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  // 1. Authoritative owner authorization guard
  const ownerAuth = await requireAuthoritativeOwner(request);
  if (!ownerAuth.success) {
    return ownerAuth.response;
  }
  const actor = ownerAuth.actor;

  try {
    const body = await request.json().catch(() => ({}));
    const targetId = typeof body.id === "string" ? body.id : typeof body.userId === "string" ? body.userId : "";

    if (!targetId) {
      return Response.json({ message: "Target user ID is required." }, { status: 400 });
    }

    // 2. Reject modifications to owner or self
    if (isOwnerAccount(targetId)) {
      return Response.json(
        { message: "The primary owner account is protected and cannot be modified." },
        { status: 403 }
      );
    }
    if (targetId === actor.id) {
      return Response.json(
        { message: "You cannot modify your own administrator role." },
        { status: 403 }
      );
    }

    // 3. Resolve requested transition (User <-> Admin)
    let targetRole: "ADMIN" | "CUSTOMER" | null = null;
    if (body.action === "PROMOTE" || body.role === "ADMIN") {
      targetRole = "ADMIN";
    } else if (body.action === "DEMOTE" || body.role === "CUSTOMER" || body.role === "USER") {
      targetRole = "CUSTOMER";
    }

    if (!targetRole) {
      return Response.json(
        { message: "Invalid transition. Only direct User ↔ Admin role transitions are permitted." },
        { status: 400 }
      );
    }

    // 4. Atomic database transition
    const result = await withTransaction(async (db) => {
      const targetRes = await db.query<{
        id: string;
        email: string;
        name: string;
        role: string;
        status: string;
        disabled: boolean;
      }>(
        `SELECT id, email, name, role, status, disabled
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [targetId]
      );
      const target = targetRes.rows[0];

      if (!target) {
        return { error: "NOT_FOUND" as const };
      }

      if (isOwnerAccount(target.id, target.email)) {
        return { error: "CANNOT_MODIFY_OWNER" as const };
      }

      if (target.role==="SUPER_ADMIN") {
        return { error: "CANNOT_MODIFY_SUPER_ADMIN" as const };
      }

      const isCurrentAdmin = target.role === "ADMIN";
      const isCurrentUser = target.role === "CUSTOMER" || target.role === "USER";

      // Idempotency check: already in target role
      if (
        (targetRole === "ADMIN" && isCurrentAdmin) ||
        (targetRole === "CUSTOMER" && isCurrentUser)
      ) {
        return {
          noOp: true as const,
          target,
          previousRole: target.role,
          newRole: targetRole,
        };
      }

      // Validate allowed transitions
      if (targetRole === "ADMIN" && !isCurrentUser) {
        return { error: "INVALID_TRANSITION" as const };
      }
      if (targetRole === "CUSTOMER" && !isCurrentAdmin) {
        return { error: "INVALID_TRANSITION" as const };
      }

      // Apply transition atomically, preserving user status, disabled state, and feature permissions
      await db.query(
        `UPDATE users
         SET role = $1, session_version = session_version + 1, updated_at = NOW()
         WHERE id = $2`,
        [targetRole, target.id]
      );

      return {
        noOp: false as const,
        target,
        previousRole: target.role,
        newRole: targetRole,
      };
    });

    if ("error" in result) {
      if (result.error === "NOT_FOUND") {
        return Response.json({ message: "Target user account not found." }, { status: 404 });
      }
      if (result.error === "CANNOT_MODIFY_OWNER") {
        return Response.json({ message: "The primary owner account is protected." }, { status: 403 });
      }
      if (result.error === "CANNOT_MODIFY_SUPER_ADMIN") {
        return Response.json({ message: "Super Admin accounts cannot be demoted through this workflow." }, { status: 403 });
      }
      return Response.json({ message: "Invalid role transition." }, { status: 400 });
    }

    // 5. Record in audit trail if change occurred
    if (!result.noOp) {
      await audit(
        actor,
        targetRole === "ADMIN" ? "ADMIN_PROMOTED" : "ADMIN_DEMOTED",
        "users",
        targetId,
        {
          id: result.target.id,
          email: result.target.email,
          name: result.target.name,
          role: result.previousRole,
        },
        {
          id: result.target.id,
          email: result.target.email,
          name: result.target.name,
          role: result.newRole,
        }
      );
    }

    return Response.json({
      ok: true,
      userId: targetId,
      role: result.newRole,
      message:
        result.newRole === "ADMIN"
          ? result.noOp
            ? "User is already an administrator."
            : `Successfully promoted ${result.target.email} to Administrator.`
          : result.noOp
          ? "User is already a regular user."
          : `Successfully removed Administrator privileges from ${result.target.email}.`,
      alreadyAdmin: result.noOp && result.newRole === "ADMIN",
      alreadyCustomer: result.noOp && result.newRole === "CUSTOMER",
    });
  } catch (error) {
    return safeError(error);
  }
}
