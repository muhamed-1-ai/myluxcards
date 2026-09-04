import { currentIdentity } from "@/lib/adminAuth";
import { getCrmCalendarData } from "@/lib/crm";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const yearMonth = searchParams.get("month") || defaultYearMonth;
  const dateStr = searchParams.get("date") || undefined;

  try {
    const data = await getCrmCalendarData(identity.id, yearMonth, dateStr);
    return Response.json(data);
  } catch (error) {
    console.error("[CRM Calendar API] Error:", error);
    return Response.json(
      { message: "Failed to load calendar data." },
      { status: 500 }
    );
  }
}
