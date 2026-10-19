import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/auth/currentIdentity";
import { isAccountingEntitled } from "@/lib/permissionsRegistry";
import { listUserWorkspaces, createWorkspace, ensureDefaultWorkspace } from "@/lib/accounting/workspaces";

export async function GET(req: Request) {
  const identity = await currentIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isAccountingEntitled(identity.featurePermissions, identity.role)) {
    return NextResponse.json({ error: "ACCOUNTING_ACCESS_DENIED" }, { status: 403 });
  }

  let workspaces = await listUserWorkspaces(identity.id);
  if (workspaces.length === 0) {
    const defaultWs = await ensureDefaultWorkspace(identity.id, identity.name);
    workspaces = [defaultWs];
  }

  return NextResponse.json({ workspaces });
}

export async function POST(req: Request) {
  const identity = await currentIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isAccountingEntitled(identity.featurePermissions, identity.role)) {
    return NextResponse.json({ error: "ACCOUNTING_ACCESS_DENIED" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const workspace = await createWorkspace(identity.id, {
      name: body.name,
      type: body.type || "BUSINESS",
      currency: body.currency,
      timezone: body.timezone,
      profileTemplate: body.profileTemplate,
    });
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create workspace" }, { status: 400 });
  }
}
