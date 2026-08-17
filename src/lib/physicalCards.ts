import "server-only";
import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { pool } from "@/lib/db";
import { hashCardToken, newPublicCardToken } from "@/lib/security/cardTokens";

export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const unavailableStatuses = new Set(["DISABLED", "REPLACED", "LOST", "RETIRED"]);

export function canonicalAppUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://myluxcards.com").replace(/\/$/, "");
}

export function physicalCardUrl(token: string) {
  return `${canonicalAppUrl()}/t/${token}`;
}

export async function generateQrArtifacts(url: string) {
  const options = { errorCorrectionLevel: "H" as const, margin: 4, color: { dark: "#000000", light: "#ffffff" } };
  const [svg, png] = await Promise.all([
    QRCode.toString(url, { ...options, type: "svg" }),
    QRCode.toBuffer(url, { ...options, type: "png", width: 1600 }),
  ]);
  return { svg, png, sha256: createHash("sha256").update(svg).digest("hex") };
}

export async function createPhysicalCard(input: { actorId: string; mode?: "STOCK" | "PERSONALIZED"; ownerId?: string | null; digitalCardId?: string | null; productId?: string | null; orderId?: string | null; orderItemId?: string | null; batchId?: string | null }) {
  const token = newPublicCardToken();
  const url = physicalCardUrl(token);
  const qr = await generateQrArtifacts(url);
  const inventoryReference = `MLC-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const assigned = Boolean(input.ownerId);
  const result = await pool.query<{ id: string }>(
    `with inserted as (
       insert into cards(owner_id,digital_card_id,public_token_hash,inventory_reference,status,card_mode,batch_id,product_id,order_id,order_item_id,qr_svg,qr_png,qr_sha256,assigned_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,case when $1::uuid is null then null else now() end) returning id
     ), events as (
       insert into card_lifecycle_events(card_id,event_type,actor_id,channel)
       select id,'GENERATED',$14,'ADMIN' from inserted
       union all select id,'QR_GENERATED',$14,'ADMIN' from inserted
     ) select id from inserted`,
    [input.ownerId || null,input.digitalCardId || null,hashCardToken(token),inventoryReference,assigned ? "ASSIGNED" : "UNASSIGNED",input.mode || "STOCK",input.batchId || null,input.productId || null,input.orderId || null,input.orderItemId || null,qr.svg,qr.png,qr.sha256,input.actorId]
  );
  return { id: result.rows[0].id, inventoryReference, url };
}

export async function resolvePhysicalCard(token: string) {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return null;
  const result = await pool.query<{
    id:string; owner_id:string|null; digital_card_id:string|null; status:string; card_mode:string;
    inventory_reference:string|null; slug:string|null; active:boolean|null; activated_at:Date|null;
  }>(`select c.id,c.owner_id,c.digital_card_id,c.status,c.card_mode,c.inventory_reference,d.slug,d.active,d.activated_at
      from cards c left join digital_cards d on d.id=c.digital_card_id where c.public_token_hash=$1`,[hashCardToken(token)]);
  return result.rows[0] || null;
}

export async function claimPhysicalCard(token: string, userId: string) {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return { state: "NOT_FOUND" as const };
  const client = await pool.connect();
  try {
    await client.query("begin");
    const found = await client.query<{id:string;owner_id:string|null;digital_card_id:string|null;status:string}>(
      "select id,owner_id,digital_card_id,status from cards where public_token_hash=$1 for update",[hashCardToken(token)]
    );
    const card = found.rows[0];
    if (!card) { await client.query("rollback"); return { state:"NOT_FOUND" as const }; }
    if (unavailableStatuses.has(card.status)) { await client.query("rollback"); return { state:"UNAVAILABLE" as const }; }
    if (card.owner_id && card.owner_id !== userId) { await client.query("rollback"); return { state:"ALREADY_CLAIMED" as const }; }
    let digitalCardId = card.digital_card_id;
    let slug: string;
    if (digitalCardId) {
      const digital = await client.query<{slug:string}>("select slug from digital_cards where id=$1",[digitalCardId]);
      slug = digital.rows[0]?.slug;
    } else {
      const user = await client.query<{name:string}>("select name from users where id=$1 and disabled=false",[userId]);
      if (!user.rows[0]) throw new Error("USER_UNAVAILABLE");
      const base = user.rows[0].name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40) || "my-card";
      slug = `${base}-${randomBytes(4).toString("hex")}`;
      const created = await client.query<{id:string}>("insert into digital_cards(owner_id,slug,active,activated_at) values($1,$2,true,now()) returning id",[userId,slug]);
      digitalCardId = created.rows[0].id;
    }
    if (card.owner_id === userId) { await client.query("commit"); return { state:"CLAIMED" as const, slug }; }
    await client.query("update cards set owner_id=$1,digital_card_id=$2,status='ACTIVE',assigned_at=coalesce(assigned_at,now()),claimed_at=now(),activated_at=now(),updated_at=now() where id=$3",[userId,digitalCardId,card.id]);
    await client.query("update digital_cards set owner_id=$1,active=true,activated_at=coalesce(activated_at,now()),updated_at=now() where id=$2",[userId,digitalCardId]);
    await client.query("insert into card_lifecycle_events(card_id,event_type,actor_id,channel) values($1,'CLAIMED',$2,'LINK'),($1,'ACTIVATED',$2,'LINK')",[card.id,userId]);
    await client.query("commit");
    return { state:"CLAIMED" as const, slug };
  } catch (error) { await client.query("rollback"); throw error; }
  finally { client.release(); }
}
