import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type {
  WorkspaceRow,
  WorkspaceMemberRow,
  WorkspaceRole,
  WorkspaceType,
  ProfileTemplate,
} from "./types";
import { seedDefaultChartOfAccounts } from "./accounts";
import { seedDefaultCategories } from "./categories";

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 4,
  MANAGER: 3,
  STAFF: 2,
  VIEWER: 1,
};

export function hasRequiredRole(userRole: WorkspaceRole, requiredRole?: WorkspaceRole): boolean {
  if (!requiredRole) return true;
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

/**
 * List all workspaces accessible by the user with their role.
 */
export async function listUserWorkspaces(userId: string): Promise<Array<WorkspaceRow & { role: WorkspaceRole }>> {
  const query = `
    SELECT w.*, m.role
    FROM accounting_workspaces w
    JOIN accounting_workspace_members m ON m.workspace_id = w.id
    WHERE m.user_id = $1
    ORDER BY (w.type = 'PERSONAL') DESC, w.created_at ASC
  `;
  const res = await pool.query<WorkspaceRow & { role: WorkspaceRole }>(query, [userId]);
  return res.rows;
}

/**
 * Authorize workspace access for user, enforcing tenancy boundary and role requirements.
 */
export async function getAuthorizedWorkspace(
  userId: string,
  workspaceId: string,
  requiredRole?: WorkspaceRole
): Promise<(WorkspaceRow & { role: WorkspaceRole }) | null> {
  const query = `
    SELECT w.*, m.role
    FROM accounting_workspaces w
    JOIN accounting_workspace_members m ON m.workspace_id = w.id
    WHERE w.id = $1 AND m.user_id = $2
    LIMIT 1
  `;
  const res = await pool.query<WorkspaceRow & { role: WorkspaceRole }>(query, [workspaceId, userId]);
  const ws = res.rows[0];
  if (!ws) return null;

  if (requiredRole && !hasRequiredRole(ws.role, requiredRole)) {
    return null;
  }
  return ws;
}

/**
 * Ensure a user has at least one active workspace (auto-provisioning on first onboarding).
 */
export async function ensureDefaultWorkspace(
  userId: string,
  userName?: string | null,
  template: ProfileTemplate = "BUSINESS_OWNER"
): Promise<WorkspaceRow & { role: WorkspaceRole }> {
  const existing = await listUserWorkspaces(userId);
  if (existing.length > 0) {
    return existing[0];
  }

  const workspaceName = userName ? `${userName.trim()}'s Finances` : "My Business";
  const workspaceType: WorkspaceType = template === "INDIVIDUAL" || template === "EMPLOYEE" ? "PERSONAL" : "BUSINESS";

  return withTransaction(async (client) => {
    // 1. Create workspace
    const wsRes = await client.query<WorkspaceRow>(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, $2, $3, 'INR', 'Asia/Kolkata', $4)
       RETURNING *`,
      [userId, workspaceName, workspaceType, template]
    );
    const workspace = wsRes.rows[0];

    // 2. Add owner membership
    await client.query<WorkspaceMemberRow>(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [workspace.id, userId]
    );

    // 3. Seed Chart of Accounts
    await seedDefaultChartOfAccounts(workspace.id, client);

    // 4. Seed Dynamic Categories
    await seedDefaultCategories(workspace.id, template, client);

    return { ...workspace, role: "OWNER" as WorkspaceRole };
  });
}

/**
 * Create a new workspace under user ownership.
 */
export async function createWorkspace(
  userId: string,
  input: {
    name: string;
    type: WorkspaceType;
    currency?: string;
    timezone?: string;
    profileTemplate?: ProfileTemplate;
  }
): Promise<WorkspaceRow & { role: WorkspaceRole }> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Workspace name must be at least 2 characters.");

  const currency = input.currency || "INR";
  const timezone = input.timezone || "Asia/Kolkata";
  const template = input.profileTemplate || "BUSINESS_OWNER";

  return withTransaction(async (client) => {
    const wsRes = await client.query<WorkspaceRow>(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, currency, timezone, profile_template)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, name, input.type, currency, timezone, template]
    );
    const workspace = wsRes.rows[0];

    await client.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [workspace.id, userId]
    );

    await seedDefaultChartOfAccounts(workspace.id, client);
    await seedDefaultCategories(workspace.id, template, client);

    return { ...workspace, role: "OWNER" as WorkspaceRole };
  });
}
