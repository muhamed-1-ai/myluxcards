import { cleanSlug } from "@/lib/cards";
import { validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 320);
    const phone = String(body.phone || "").trim().slice(0, 30);
    if (name.length < 2 || (!email && !phone) || body.consent !== true) {
      return Response.json({ message: "Enter your name, email or phone, and confirm consent." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ message: "Enter a valid email." }, { status: 400 });
    }
    const cleaned = cleanSlug(slug);
    const cardRes = await pool.query<{ id: string; active: boolean }>(
      `select id, active from digital_cards where slug = $1 limit 1`,
      [cleaned]
    );
    const card = cardRes.rows[0];
    if (!card?.active) return Response.json({ message: "Card unavailable." }, { status: 404 });

    const company = String(body.company || "").trim().slice(0, 160) || null;
    const message = String(body.message || "").trim().slice(0, 1000) || null;
    const consentAt = new Date();

    await pool.query(
      `insert into card_leads (card_id, name, email, phone, company, message, consent_at) values ($1, $2, $3, $4, $5, $6, $7)`,
      [card.id, name, email || null, phone || null, company, message, consentAt]
    );
    await pool.query(
      `insert into card_events (card_id, event_type, channel) values ($1, 'LEAD', 'LINK')`,
      [card.id]
    ).catch(() => null);

    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ message: "Your details could not be sent." }, { status: 500 });
  }
}
