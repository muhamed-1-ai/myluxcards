import { cleanText, requireApprovedAffiliate, safeDestination } from "@/lib/affiliate";
import { safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { affiliate } = await requireApprovedAffiliate();
  if (!affiliate) return Response.json({ message: "Only approved affiliates can create links." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const name = cleanText(body.name, 80);
    const source = cleanText(body.source, 80).replace(/[^a-zA-Z0-9 _.-]/g, "");
    const destination = safeDestination(body.destinationPath);
    if (name.length < 2) return Response.json({ message: "Enter a campaign name." }, { status: 400 });
    const { data } = await supabaseJson("/rest/v1/affiliate_campaigns", {
      method: "POST",
      body: JSON.stringify({ affiliate_id: affiliate.id, name, source: source || null, destination_path: destination }),
    }, true);
    return Response.json({ data: data?.[0] }, { status: 201 });
  } catch (error) {
    if ((error as { status?: number }).status === 409) return Response.json({ message: "Campaign names must be unique." }, { status: 409 });
    return safeError(error);
  }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { affiliate } = await requireApprovedAffiliate();
  if (!affiliate) return Response.json({ message: "Forbidden." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || typeof body.active !== "boolean") return Response.json({ message: "Invalid campaign." }, { status: 400 });
    const { data } = await supabaseJson(`/rest/v1/affiliate_campaigns?id=eq.${encodeURIComponent(body.id)}&affiliate_id=eq.${affiliate.id}`, {
      method: "PATCH", body: JSON.stringify({ active: body.active, updated_at: new Date().toISOString() }),
    }, true);
    if (!data?.[0]) return Response.json({ message: "Campaign not found." }, { status: 404 });
    return Response.json({ data: data[0] });
  } catch (error) { return safeError(error); }
}
