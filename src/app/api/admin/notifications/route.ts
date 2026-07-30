import { requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 25));
    const from = (page - 1) * pageSize;
    const { data, response } = await supabaseJson(
      "/rest/v1/admin_notifications?select=id,type,title,message,order_id,read_at,emailed_at,created_at&order=created_at.desc",
      { headers: { Prefer: "count=exact", Range: `${from}-${from + pageSize - 1}` } },
      true,
    );
    return Response.json({ data, page, pageSize, total: Number(response.headers.get("content-range")?.split("/")[1] || 0) });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid notification." }, { status: 400 });
    const { data } = await supabaseJson(
      `/rest/v1/admin_notifications?id=eq.${encodeURIComponent(body.id)}`,
      { method: "PATCH", body: JSON.stringify({ read_at: body.read === false ? null : new Date().toISOString() }) },
      true,
    );
    if (!data?.length) return Response.json({ message: "Notification not found." }, { status: 404 });
    return Response.json({ data: data[0] });
  } catch (error) { return safeError(error); }
}
