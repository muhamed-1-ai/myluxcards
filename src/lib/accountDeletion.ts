import "server-only";
import { pool, withTransaction } from "./db/index";
import { AdminIdentity, audit } from "./adminAuth";
import { isOwnerAccount, isAuthoritativeOwner } from "./ownerAuth";
import type { UserRow } from "@/types/database";

export interface AccountDeletionResult {
  success: boolean;
  status: number;
  message: string;
  code?: string;
  user?: Partial<UserRow>;
  sharedWorkspaces?: Array<{ id: string; name: string; memberCount: number }>;
}

export interface DeleteUserOptions {
  admin: AdminIdentity;
  targetUserId: string;
  confirmationEmail: string;
}

/**
 * Executes a secure, logical deletion of a managed user account.
 * Enforces administrative authorization, confirmation matching, owner/admin protections,
 * and shared resource ownership transfer guardrails.
 */
export async function deleteUserAccount({
  admin,
  targetUserId,
  confirmationEmail,
}: DeleteUserOptions): Promise<AccountDeletionResult> {
  // 1. Authorization: Only SUPER_ADMIN (or Authoritative Owner) can delete accounts
  if (admin.role !== "SUPER_ADMIN" && !isAuthoritativeOwner(admin)) {
    return {
      success: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Only Super Admins are authorized to delete user accounts.",
    };
  }

  // 2. Prevent self-deletion
  if (admin.id === targetUserId) {
    return {
      success: false,
      status: 400,
      code: "SELF_DELETION_FORBIDDEN",
      message: "Self-deletion is not permitted. You cannot delete your own account.",
    };
  }

  return withTransaction(async (db) => {
    // 3. Acquire target user with row-level lock for concurrency safety
    const targetRes = await db.query<UserRow>(
      `SELECT id, email, name, role, status, disabled, created_at
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [targetUserId]
    );

    const targetUser = targetRes.rows[0];
    if (!targetUser) {
      return {
        success: false,
        status: 404,
        code: "USER_NOT_FOUND",
        message: "Target user not found.",
      };
    }

    // 4. Repeated requests safety: handle already deleted accounts
    if (targetUser.status === "DELETED") {
      return {
        success: false,
        status: 400,
        code: "ALREADY_DELETED",
        message: "This account has already been deleted.",
      };
    }

    // 5. Require explicit email confirmation match
    const normalizedConfirmation = confirmationEmail ? confirmationEmail.trim().toLowerCase() : "";
    const normalizedTargetEmail = targetUser.email.trim().toLowerCase();
    if (!normalizedConfirmation || normalizedConfirmation !== normalizedTargetEmail) {
      return {
        success: false,
        status: 400,
        code: "CONFIRMATION_EMAIL_MISMATCH",
        message: `Confirmation email mismatch. Expected "${targetUser.email}".`,
      };
    }

    // 6. Protect primary owner account
    if (isOwnerAccount(targetUser.id, targetUser.email)) {
      return {
        success: false,
        status: 403,
        code: "PROTECTED_ACCOUNT",
        message: "The primary owner account is protected and cannot be deleted.",
      };
    }

    // 7. Protect administrator accounts & last active SUPER_ADMIN
    if (targetUser.role === "ADMIN" || targetUser.role === "SUPER_ADMIN") {
      if (!isAuthoritativeOwner(admin)) {
        return {
          success: false,
          status: 403,
          code: "OWNER_ONLY",
          message: "Only the primary owner can delete an administrator account.",
        };
      }

      if (targetUser.role === "SUPER_ADMIN") {
        const superCountRes = await db.query<{ count: string }>(
          `SELECT count(*) FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' AND disabled = false`
        );
        const activeSuperCount = parseInt(superCountRes.rows[0]?.count || "0", 10);
        if (activeSuperCount <= 1) {
          return {
            success: false,
            status: 400,
            code: "LAST_SUPER_ADMIN",
            message: "Cannot delete the last active Super Admin account.",
          };
        }
      }
    }

    // 8. Shared resource check: Check if user is the sole owner of shared workspaces with other members
    const sharedWorkspacesRes = await db.query<{ id: string; name: string; member_count: number }>(
      `SELECT w.id, w.name, count(m.id)::int as member_count
       FROM accounting_workspaces w
       JOIN accounting_workspace_members m ON m.workspace_id = w.id
       WHERE w.owner_user_id = $1
       GROUP BY w.id, w.name
       HAVING count(m.id) > 1`,
      [targetUserId]
    );

    if (sharedWorkspacesRes.rows.length > 0) {
      const workspaceNames = sharedWorkspacesRes.rows.map((w) => `"${w.name}"`).join(", ");
      return {
        success: false,
        status: 409,
        code: "OWNERSHIP_TRANSFER_REQUIRED",
        message: `Cannot delete account: This user is the sole owner of shared workspace(s) (${workspaceNames}) with active members. Please transfer workspace ownership before deleting this account.`,
        sharedWorkspaces: sharedWorkspacesRes.rows.map((w) => ({
          id: w.id,
          name: w.name,
          memberCount: w.member_count,
        })),
      };
    }

    // 9. Atomic Logical Deletion & Email Release
    const tombstoneEmail = `deleted+${targetUserId}@deleted.zappit.local`;
    const deletedUserRes = await db.query<UserRow>(
      `UPDATE users
       SET original_email = email,
           email = $2,
           status = 'DELETED',
           disabled = true,
           deleted_at = NOW(),
           deleted_by_admin_id = $3,
           session_version = session_version + 1,
           password_hash = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, original_email, name, role, status, disabled, deleted_at, deleted_by_admin_id`,
      [targetUserId, tombstoneEmail, admin.id]
    );
    const updatedUser = deletedUserRes.rows[0];

    // 10. Invalidate auth action tokens (password reset, setup links)
    await db.query(
      `UPDATE auth_action_tokens
       SET consumed_at = NOW()
       WHERE user_id = $1 AND consumed_at IS NULL`,
      [targetUserId]
    );

    // 11. Invalidate linked accounts to revoke OAuth credentials
    await db.query(`DELETE FROM accounts WHERE user_id = $1`, [targetUserId]);

    // 12. Invalidate push subscriptions
    await db.query(`DELETE FROM push_subscriptions WHERE user_id = $1`, [targetUserId]);

    // 13. Revoke accounting workspace memberships
    await db.query(`DELETE FROM accounting_workspace_members WHERE user_id = $1`, [targetUserId]);

    // 14. Cancel scheduled future follow-up reminder jobs
    await db.query(
      `UPDATE lead_follow_ups
       SET status = 'CANCELLED',
           dismissed_at = NOW(),
           updated_at = NOW()
       WHERE (owner_user_id = $1 OR lead_id IN (SELECT id FROM leads WHERE owner_user_id = $1))
         AND status = 'SCHEDULED'`,
      [targetUserId]
    );

    // 15. Make exclusively owned digital card public profiles unavailable
    await db.query(
      `UPDATE digital_cards
       SET active = false,
           updated_at = NOW()
       WHERE owner_id = $1`,
      [targetUserId]
    );

    // 16. Disable physical cards
    await db.query(
      `UPDATE cards
       SET status = 'DISABLED',
           updated_at = NOW()
       WHERE digital_card_id IN (SELECT id FROM digital_cards WHERE owner_id = $1)`,
      [targetUserId]
    );

    // 17. Record audit event with full trail
    await audit(
      admin,
      "USER_DELETED",
      "users",
      targetUser.id,
      {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        status: targetUser.status,
      },
      {
        id: targetUser.id,
        email: targetUser.email,
        tombstone_email: tombstoneEmail,
        name: targetUser.name,
        role: targetUser.role,
        status: "DELETED",
        disabled: true,
        deleted_at: updatedUser.deleted_at,
        deleted_by_admin_id: admin.id,
        outcome: "SUCCESS",
      }
    );

    return {
      success: true,
      status: 200,
      message: `Account for ${targetUser.email} deleted successfully.`,
      user: updatedUser,
    };
  });
}
