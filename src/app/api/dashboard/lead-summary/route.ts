import { currentIdentity } from "@/lib/adminAuth";
import { getDashboardSummaryData } from "@/lib/crm";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ error: "UNAUTHORIZED", message: "Unauthorized account access." }, { status: 401 });
  }

  try {
    const data = await getDashboardSummaryData(identity.id);
    return Response.json(data);
  } catch (error) {
    console.error("[Dashboard Summary API] Error:", error);
    return Response.json(
      { message: "Failed to load dashboard summary." },
      { status: 500 }
    );
  }
}
