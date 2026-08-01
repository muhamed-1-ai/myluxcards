const esc=(value:unknown)=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

async function send(to:string,subject:string,html:string,key:string){
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return false;
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":key.slice(0,256)},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,html}),cache:"no-store"});
  return response.ok;
}
export function sendOrderConfirmation(order:{id:string;number:string;name:string;email:string;totalMinor:number;currency:string;paymentStatus:string}){
  const url=`${(process.env.APP_URL||"https://myluxcards.vercel.app").replace(/\/$/,"")}/orders`;
  return send(order.email,`We received order ${order.number}`,`<h1>Thanks, ${esc(order.name)}</h1><p>We received order <strong>${esc(order.number)}</strong> for ${esc(order.currency)} ${(order.totalMinor/100).toFixed(2)}.</p><p>Payment status: ${esc(order.paymentStatus)}.</p><p><a href="${esc(url)}">View your order</a></p>`,`customer-order-${order.id}`);
}
export function sendOrderStatus(order:{id:string;number:string;name:string;email:string;status:string;courier?:string|null;tracking?:string|null}){
  const url=`${(process.env.APP_URL||"https://myluxcards.vercel.app").replace(/\/$/,"")}/orders`;
  return send(order.email,`Order ${order.number}: ${order.status.replaceAll("_"," ")}`,`<h1>Order update</h1><p>Hello ${esc(order.name)}, order <strong>${esc(order.number)}</strong> is now <strong>${esc(order.status.replaceAll("_"," "))}</strong>.</p>${order.tracking?`<p>${esc(order.courier||"Courier")} tracking: ${esc(order.tracking)}</p>`:""}<p><a href="${esc(url)}">View order details</a></p>`,`order-status-${order.id}-${order.status}-${order.tracking||"none"}`);
}
