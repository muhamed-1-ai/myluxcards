import { currentIdentity } from "@/lib/adminAuth";
import { getDashboardSummaryData } from "@/lib/crm";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
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
