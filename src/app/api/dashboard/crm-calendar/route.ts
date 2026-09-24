import { currentIdentity } from "@/lib/adminAuth";
import { getCrmCalendarData } from "@/lib/crm";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ error: "UNAUTHORIZED", message: "Unauthorized account access." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = searchParams.get("month") || defaultYearMonth;
  const dateStr = searchParams.get("date") || undefined;
  const ownership = searchParams.get("ownership") || "MY";

  try {
    const data = await getCrmCalendarData(identity.id, yearMonth, dateStr, ownership, identity.role);
    return Response.json(data);
  } catch (error) {
    console.error("[CRM Calendar API] Error:", error);
    return Response.json(
      { message: "Failed to load calendar data." },
      { status: 500 }
    );
  }
}
