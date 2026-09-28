import { currentIdentity } from "@/lib/adminAuth";
import { getDashboardSummaryData, DashboardFilterOptions, DEFAULT_DASHBOARD_SUMMARY } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);

  // STEP 1: Server Logging
  console.log("[DASHBOARD_SUMMARY_START]", {
    userId: identity?.id || null,
    timestamp: new Date().toISOString(),
  });

  console.log("[SESSION_DATA]", identity ? { id: identity.id, role: identity.role, email: identity.email } : null);

  if (!identity) {
    return Response.json({ error: "UNAUTHORIZED", message: "Unauthorized account access." }, { status: 401 });
  }

  // STEP 4: Handle Missing Account Data
  if (!identity.id) {
    console.log("[ACCOUNT_DATA]", { accountId: null, warning: "No user account ID present" });
    return Response.json({
      success: true,
      accountId: null,
      userId: null,
      ...DEFAULT_DASHBOARD_SUMMARY,
    });
  }

  console.log("[ACCOUNT_DATA]", { accountId: identity.id, role: identity.role });

  const { searchParams } = new URL(request.url);
  const filters: DashboardFilterOptions = {
    search: searchParams.get("search") || undefined,
    office: searchParams.get("office") || undefined,
    user: searchParams.get("user") || undefined,
    stage: searchParams.get("stage") || undefined,
    source: searchParams.get("source") || undefined,
    status: searchParams.get("status") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
  };

  try {
    const data = await getDashboardSummaryData(identity.id, filters, identity.role);

    console.log("[DATABASE_RESULT]", {
      totalLeads: data.kpis.totalLeads,
      attentionItemsCount: data.attentionItems.length,
      todaysFollowUpsCount: data.todaysFollowUps.length,
    });

    return Response.json({
      success: true,
      accountId: identity.id,
      userId: identity.id,
      ...data,
    });
  } catch (error) {
    console.error("[DASHBOARD_SUMMARY_ERROR]", error);
    return Response.json(
      {
        error: "Dashboard loading failed",
        message: error instanceof Error ? error.message : "Failed to load dashboard summary.",
      },
      { status: 500 }
    );
  }
}

