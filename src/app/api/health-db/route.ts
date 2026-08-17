// src/app/api/health-db/route.ts
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query<{ ok: number }>("SELECT 1 as ok");
    return Response.json({ ok: true, result: result.rows[0] }, { status: 200 });
  } catch (error) {
    console.error("[Health DB] Connection failed:", error);
    return new Response(JSON.stringify({ ok: false, error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
