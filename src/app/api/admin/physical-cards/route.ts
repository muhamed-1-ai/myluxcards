import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { pool } from "@/lib/db";
import { createPhysicalCard } from "@/lib/physicalCards";

const uuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f-]{36}$/i.test(value)?value:null;

export async function GET() {
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});
  try{const result=await pool.query(`select c.id,c.inventory_reference,c.status,c.card_mode,c.created_at,c.assigned_at,c.programmed_at,c.activated_at,c.owner_id,c.digital_card_id,c.order_id,c.batch_id,
    u.name as customer_name,u.email as customer_email,p.phone as customer_phone,d.slug,b.reference as batch_reference,o.order_number,
    (c.qr_svg is not null and c.qr_png is not null) as qr_ready,
    (select count(*)::int from card_lifecycle_events e where e.card_id=c.id and e.event_type='VIEW') as interaction_count,
    (select max(e.created_at) from card_lifecycle_events e where e.card_id=c.id and e.event_type='VIEW') as last_interaction
    from cards c left join users u on u.id=c.owner_id left join profiles p on p.id=u.id left join digital_cards d on d.id=c.digital_card_id left join card_batches b on b.id=c.batch_id left join orders o on o.id=c.order_id order by c.created_at desc limit 1000`);
    return Response.json({data:result.rows},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return safeError(error)}
}

export async function POST(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});
  try{const body=await request.json().catch(()=>({}));const quantity=Math.min(100,Math.max(1,Math.floor(Number(body.quantity)||1)));const mode=body.mode==="PERSONALIZED"?"PERSONALIZED":"STOCK";
    const ownerId=uuid(body.ownerId),digitalCardId=uuid(body.digitalCardId),productId=uuid(body.productId),orderId=uuid(body.orderId),orderItemId=uuid(body.orderItemId);
    if(mode==="PERSONALIZED"&&!ownerId)return Response.json({message:"Personalized cards require a customer."},{status:400});
    if(quantity>1&&mode!=="STOCK")return Response.json({message:"Bulk creation is available for stock cards only."},{status:400});
    let batchId:string|null=null,batchReference:string|null=null;
    if(quantity>1){batchReference=String(body.batchReference||`BATCH-${Date.now().toString(36)}`).toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,40);const batch=await pool.query<{id:string}>("insert into card_batches(reference,product_id,quantity,created_by) values($1,$2,$3,$4) returning id",[batchReference,productId,quantity,actor.id]);batchId=batch.rows[0].id;}
    const cards=[];for(let i=0;i<quantity;i++)cards.push(await createPhysicalCard({actorId:actor.id,mode,ownerId,digitalCardId,productId,orderId,orderItemId,batchId}));
    if(batchId)await pool.query("update card_batches set status='READY',completed_at=now() where id=$1",[batchId]);
    await audit(actor,"PHYSICAL_CARDS_CREATED","card_batch",batchId,null,{quantity,mode,batchReference});
    return Response.json({cards,batchReference},{status:201,headers:{"Cache-Control":"private, no-store"}});
  }catch(error){return safeError(error)}
}

export async function PATCH(request:Request){
  if(!validMutationOrigin(request))return Response.json({message:"Invalid request origin."},{status:403});
  const actor=await requireAdmin();if(!actor)return Response.json({message:"Forbidden"},{status:403});
  try{const body=await request.json().catch(()=>({}));const cardId=uuid(body.cardId);if(!cardId)return Response.json({message:"Invalid card."},{status:400});const action=String(body.action||"");
    if(action==="DISABLE"){await pool.query("update cards set status='DISABLED',updated_at=now() where id=$1 and status not in ('REPLACED','RETIRED')",[cardId]);await pool.query("insert into card_lifecycle_events(card_id,event_type,actor_id,channel) values($1,'DISABLED',$2,'ADMIN')",[cardId,actor.id]);}
    else if(action==="PROGRAMMED"){await pool.query("update cards set status='PROGRAMMED',programmed_at=now(),updated_at=now() where id=$1 and status='UNASSIGNED'",[cardId]);await pool.query("insert into card_lifecycle_events(card_id,event_type,actor_id,channel) values($1,'PROGRAMMED',$2,'ADMIN')",[cardId,actor.id]);}
    else if(action==="ASSIGN"){const ownerId=uuid(body.ownerId),digitalCardId=uuid(body.digitalCardId);if(!ownerId||!digitalCardId)return Response.json({message:"Customer and digital card are required."},{status:400});const linked=await pool.query("select 1 from digital_cards where id=$1 and owner_id=$2",[digitalCardId,ownerId]);if(!linked.rowCount)return Response.json({message:"The digital card does not belong to that customer."},{status:409});await pool.query("update cards set owner_id=$1,digital_card_id=$2,card_mode='PERSONALIZED',status='ACTIVE',assigned_at=now(),activated_at=now(),updated_at=now() where id=$3 and owner_id is null",[ownerId,digitalCardId,cardId]);await pool.query("insert into card_lifecycle_events(card_id,event_type,actor_id,channel) values($1,'ASSIGNED',$2,'ADMIN'),($1,'ACTIVATED',$2,'ADMIN')",[cardId,actor.id]);}
    else if(action==="REPLACE"){
      const old=(await pool.query<{owner_id:string|null;digital_card_id:string|null;product_id:string|null;order_id:string|null;order_item_id:string|null}>("select owner_id,digital_card_id,product_id,order_id,order_item_id from cards where id=$1 and status not in ('REPLACED','RETIRED')",[cardId])).rows[0];
      if(!old)return Response.json({message:"This card cannot be replaced."},{status:409});
      const replacement=await createPhysicalCard({actorId:actor.id,mode:old.owner_id?"PERSONALIZED":"STOCK",ownerId:old.owner_id,productId:old.product_id,orderId:old.order_id,orderItemId:old.order_item_id});
      const client=await pool.connect();try{await client.query("begin");await client.query("update cards set status='REPLACED',replacement_card_id=$1,updated_at=now() where id=$2",[replacement.id,cardId]);if(old.digital_card_id)await client.query("update cards set digital_card_id=$1,status='ACTIVE',activated_at=now(),updated_at=now() where id=$2",[old.digital_card_id,replacement.id]);await client.query("insert into card_lifecycle_events(card_id,event_type,actor_id,channel,metadata) values($1,'REPLACED',$2,'ADMIN',$3)",[cardId,actor.id,JSON.stringify({replacementCardId:replacement.id})]);await client.query("commit");}catch(error){await client.query("rollback");await pool.query("delete from cards where id=$1",[replacement.id]);throw error}finally{client.release()}
      await audit(actor,"PHYSICAL_CARD_REPLACE","card",cardId,null,{replacementCardId:replacement.id});return Response.json({ok:true,replacement});
    }
    else return Response.json({message:"Unsupported action."},{status:400});
    await audit(actor,`PHYSICAL_CARD_${action}`,"card",cardId,null,{});return Response.json({ok:true});
  }catch(error){return safeError(error)}
}
