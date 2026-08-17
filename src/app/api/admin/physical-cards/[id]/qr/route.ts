import { requireAdmin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});const{id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({message:"Invalid card."},{status:400});
  const format=new URL(request.url).searchParams.get("format")==="png"?"png":"svg";const result=await pool.query<{inventory_reference:string;qr_svg:string|null;qr_png:Buffer|null}>("select inventory_reference,qr_svg,qr_png from cards where id=$1",[id]);const card=result.rows[0];if(!card)return Response.json({message:"Card not found."},{status:404});const artifact=format==="png"?card.qr_png:card.qr_svg;if(!artifact)return Response.json({message:"QR artifact unavailable."},{status:404});
  await pool.query("insert into card_lifecycle_events(card_id,event_type,actor_id,channel,metadata) values($1,'EXPORTED',$2,'ADMIN',$3)",[id,actor.id,JSON.stringify({format})]);
  return new Response(artifact as BodyInit,{headers:{"Content-Type":format==="png"?"image/png":"image/svg+xml","Content-Disposition":`attachment; filename="${card.inventory_reference}.${format}"`,"Cache-Control":"private, no-store"}});
}
