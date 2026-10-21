import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/auth/currentIdentity";
import { isAccountingEntitled } from "@/lib/permissionsRegistry";
import { getAuthorizedWorkspace, ensureDefaultWorkspace } from "@/lib/accounting/workspaces";
import type { WorkspaceRole, WorkspaceRow } from "@/lib/accounting/types";
import type { AuthIdentity } from "@/lib/auth/currentIdentity";

export interface AuthenticatedAccountingContext {
  identity: AuthIdentity;
  workspace: WorkspaceRow & { role: WorkspaceRole };
}

/**
 * Server-side authorization gate for Zappit Accounts API routes.
 * Strictly verifies:
 * 1. Authenticated session exists and is active.
 * 2. User has platform module entitlement for Zappit Accounts.
 * 3. User is authorized member of the requested workspace with sufficient role.
 */
export async function requireAccountingApi(
  req: Request,
  requiredRole?: WorkspaceRole
): Promise<{ errorResponse?: NextResponse; context?: AuthenticatedAccountingContext }> {
  // 1. Verify authenticated user identity
  const identity = await currentIdentity(req);
  if (!identity) {
    return {
      errorResponse: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  // 2. Verify platform module entitlement
  if (!isAccountingEntitled(identity.featurePermissions, identity.role)) {
    return {
      errorResponse: NextResponse.json(
        {
          error: "ACCOUNTING_ACCESS_DENIED",
          message: "Zappit Accounts module is not enabled for your account.",
        },
        { status: 403 }
      ),
    };
  }

  // 3. Resolve workspace from query params, header, or body (for mutations)
  const url = new URL(req.url);
  let workspaceId = url.searchParams.get("workspaceId") || req.headers.get("x-workspace-id");

  if (!workspaceId && req.method !== "GET" && req.method !== "HEAD") {
    try {
      const cloned = req.clone();
      const body = await cloned.json();
      if (body && typeof body.workspaceId === "string" && body.workspaceId.trim()) {
        workspaceId = body.workspaceId.trim();
      }
    } catch {
      // Body not JSON or unparseable, fallback to default
    }
  }

  let workspace: (WorkspaceRow & { role: WorkspaceRole }) | null = null;

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (workspaceId) {
    if (!UUID_REGEX.test(workspaceId)) {
      return {
        errorResponse: NextResponse.json(
          {
            error: "INVALID_WORKSPACE_ID",
            message: "Invalid workspace identifier format.",
          },
          { status: 400 }
        ),
      };
    }
    workspace = await getAuthorizedWorkspace(identity.id, workspaceId, requiredRole);
  } else {
    // If no workspaceId provided, get or provision default workspace
    workspace = await ensureDefaultWorkspace(identity.id, identity.name);
  }

  if (!workspace) {
    return {
      errorResponse: NextResponse.json(
        {
          error: "WORKSPACE_FORBIDDEN",
          message: "You do not have permission to access this workspace.",
        },
        { status: 403 }
      ),
    };
  }

  return { context: { identity, workspace } };
}
