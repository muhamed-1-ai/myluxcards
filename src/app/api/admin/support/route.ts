import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { supabaseJson } from "@/lib/supabaseAuth";

const statuses = new Set(["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"]);
const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

export async function GET() {
  const actor = await requireAdmin(); if (!actor) return Response.json({ message:"Forbidden" }, { status:403 });
  try { const { data } = await supabaseJson("/rest/v1/support_tickets?select=id,reference,customer_name,customer_email,topic,contact_time,message,status,assigned_to,last_reply_at,created_at,support_ticket_replies(id,author_role,message,emailed_at,created_at)&order=created_at.desc&limit=300", {}, true); return Response.json({ data:data || [] }); }
  catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message:"Invalid request origin." }, { status:403 });
  const actor = await requireAdmin(); if (!actor) return Response.json({ message:"Forbidden" }, { status:403 });
  try {
    const body = await request.json().catch(() => ({})); const id = clean(body.id, 50);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message:"Invalid ticket." }, { status:400 });
    const current = await supabaseJson(`/rest/v1/support_tickets?id=eq.${id}&select=*&limit=1`, {}, true); const ticket = current.data?.[0];
    if (!ticket) return Response.json({ message:"Ticket not found." }, { status:404 });
    const changes:any = { updated_at:new Date().toISOString() };
    let emailDelivered:boolean|undefined;
    if (statuses.has(body.status)) changes.status = body.status;
    if (body.assignToMe === true) changes.assigned_to = actor.id;
    const reply = clean(body.reply, 4000);
    if (reply) {
      emailDelivered = false;
      let emailedAt:null|string = null;
      const replyAt = new Date().toISOString();
      if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        const response = await fetch("https://api.resend.com/emails", { method:"POST", headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}`, "Content-Type":"application/json", "Idempotency-Key":`support-reply-${id}-${Date.now()}` }, body:JSON.stringify({ from:process.env.EMAIL_FROM, to:[ticket.customer_email], subject:`Re: ${ticket.reference} — MyLuxCards Support`, html:`<p>Hello ${escapeHtml(ticket.customer_name)},</p><p>${escapeHtml(reply).replaceAll("\n","<br>")}</p><p>Reference: ${escapeHtml(ticket.reference)}</p>` }) });
        if (!response.ok) return Response.json({ message:"The reply email could not be delivered. Nothing was marked as sent." }, { status:502 });
        emailedAt = replyAt;
        emailDelivered = true;
      }
      await supabaseJson("/rest/v1/support_ticket_replies", { method:"POST", body:JSON.stringify({ ticket_id:id, author_id:actor.id, author_role:actor.role, message:reply, emailed_at:emailedAt }) }, true);
      changes.last_reply_at = replyAt; changes.status = body.status && statuses.has(body.status) ? body.status : "WAITING_CUSTOMER";
    }
    await supabaseJson(`/rest/v1/support_tickets?id=eq.${id}`, { method:"PATCH", body:JSON.stringify(changes) }, true);
    await audit(actor, "SUPPORT_TICKET_UPDATED", "support_ticket", id, { status:ticket.status }, { status:changes.status, replied:Boolean(reply) });
    return Response.json({ ok:true, emailDelivered });
  } catch (error) { return safeError(error); }
}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));}
