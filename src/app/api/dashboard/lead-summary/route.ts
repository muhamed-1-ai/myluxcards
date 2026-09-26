import { currentIdentity } from "@/lib/adminAuth";
import { getDashboardSummaryData, DashboardFilterOptions } from "@/lib/crm";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ error: "UNAUTHORIZED", message: "Unauthorized account access." }, { status: 401 });
  }

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
    const data = await getDashboardSummaryData(identity.id, filters);
    return Response.json(data);
  } catch (error) {
    console.error("[Dashboard Summary API] Error:", error);
    return Response.json(
      { message: "Failed to load dashboard summary." },
      { status: 500 }
    );
  }
}
