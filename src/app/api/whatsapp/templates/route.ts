import { currentIdentity } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { decryptToken, fetchMetaTemplates } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shouldSync = searchParams.get("sync") === "true";

  try {
    const connRes = await pool.query<{ waba_id: string; access_token_encrypted: string }>(
      `select waba_id, access_token_encrypted from whatsapp_connections where user_id = $1 limit 1`,
      [identity.id]
    );

    const conn = connRes.rows[0];
    if (!conn) {
      return Response.json({ message: "WhatsApp Business Account not connected." }, { status: 400 });
    }

    if (shouldSync) {
      const accessToken = decryptToken(conn.access_token_encrypted);
      const metaTemplates = await fetchMetaTemplates(conn.waba_id, accessToken);

      for (const t of metaTemplates) {
        await pool.query(
          `insert into whatsapp_templates (user_id, waba_id, name, category, language, status, components, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, now())
           on conflict (user_id, name, language) do update
           set category = $4, status = $6, components = $7, updated_at = now()`,
          [identity.id, conn.waba_id, t.name, t.category, t.language, t.status, JSON.stringify(t.components)]
        );
      }
    }

    const tRes = await pool.query(
      `select id, name, category, language, status, components, updated_at
       from whatsapp_templates
       where user_id = $1
       order by name asc`,
      [identity.id]
    );

    return Response.json({ templates: tRes.rows });
  } catch (error: any) {
    console.error("[WhatsApp Templates GET] Error:", error);
    return Response.json({ message: error?.message || "Failed to fetch templates." }, { status: 500 });
  }
}
