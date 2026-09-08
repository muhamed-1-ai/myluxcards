"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getPublicCardUrl, getCanonicalUserQrUrl } from "@/lib/url";
import { buildPremiumQrSvg, svgToHighResPngBlob } from "@/lib/premiumQr";
import ShipOrderWorkspace from "@/components/super-admin/ShipOrderWorkspace";
import type { AdminIdentity } from "@/lib/adminAuth";

type Section = "overview"|"managed_users"|"team_calendar"|"team_leads"|"team_analytics"|"team_lob_reasons"|"orders"|"customers"|"activations"|"products"|"payments"|"support"|"notifications"|"admins"|"audit"|"settings";
type Row = Record<string, any>;
const labels: Record<Section,string> = {
  overview: "Overview",
  managed_users: "Users",
  team_calendar: "Team Calendar",
  team_leads: "Team Leads",
  team_analytics: "Team Analytics",
  team_lob_reasons: "Team LOB Reasons",
  orders: "Orders",
  customers: "Customers",
  activations: "Card assignment",
  products: "Products",
  payments: "Payments",
  support: "Support tickets",
  notifications: "Notifications",
  admins: "Admin management",
  audit: "Audit logs",
  settings: "Settings",
};
const money = (minor=0,currency="INR") => new Intl.NumberFormat("en-IN",{style:"currency",currency}).format(minor/100);

export default function AdminApp({ identity }:{identity:AdminIdentity}) {
  const [section,setSection]=useState<Section>("overview"), [mobile,setMobile]=useState(false);
  const [data,setData]=useState<any>(null), [loading,setLoading]=useState(true), [error,setError]=useState(""), [search,setSearch]=useState("");
  const [shipOrderId, setShipOrderId] = useState<string | null>(null);
  const loadVersion=useRef(0);
  const load=useCallback(async()=>{
    const version=++loadVersion.current;
    setLoading(true);setError("");
    let path: string = section;
    if (section === "overview") path = "dashboard";
    else if (section === "activations") path = "customers";
    else if (section === "managed_users") path = "managed-users";
    else if (section.startsWith("team_")) path = `team/${section.replace("team_", "").replace("_", "-")}`;

    try { const response=await fetch(`/api/admin/${path}${search&&["orders","customers","managed_users","team_leads"].includes(section)?`?search=${encodeURIComponent(search)}`:""}`,{cache:"no-store"});
      if(response.status===403){window.location.replace("/forbidden");return}
      if(!response.ok) throw new Error((await response.json()).message||"Request failed.");
      const payload=await response.json();
      if(version===loadVersion.current)setData(payload);
    } catch(e){if(version===loadVersion.current)setError(e instanceof Error?e.message:"Could not load this section.")} finally{if(version===loadVersion.current)setLoading(false)}
  },[section,search]);
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("section") as Section|null;if(requested&&Object.hasOwn(labels,requested))setSection(requested)},[]);
  useEffect(()=>{load()},[load]);
  const mutate=async(path:string,method:string,body:unknown)=>{
    const response=await fetch(`/api/admin/${path}`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json(); if(!response.ok) throw new Error(result.message||"Request failed."); await load(); return result;
  };
  const navigate=(next:Section)=>{setSection(next);setSearch("");setMobile(false);const url=new URL(window.location.href);if(next==="overview")url.searchParams.delete("section");else url.searchParams.set("section",next);window.history.replaceState(null,"",url)};
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST"});localStorage.removeItem("myluxcards_current_user");window.location.replace("/")};

  if (shipOrderId) {
    return (
      <ShipOrderWorkspace
        orderId={shipOrderId}
        onBack={() => setShipOrderId(null)}
      />
    );
  }

  return <div className="admin-shell">
    <header className="admin-top"><button className="admin-menu" onClick={()=>setMobile(!mobile)} aria-label={mobile?"Close admin navigation":"Open admin navigation"} aria-expanded={mobile}>☰</button><a href="/" className="admin-logo">3G ZAPPIT <span>ADMIN</span></a><div className="admin-identity"><strong>{identity.name}</strong><small>{identity.role.replace("_"," ")}</small></div></header>
    {mobile&&<button className="admin-scrim" onClick={()=>setMobile(false)} aria-label="Close menu"/>}
    <aside className={mobile?"open":""}>
      <p>ADMINISTRATION</p>
      <nav>
        <button className={section==="overview"?"active":""} onClick={()=>navigate("overview")}>🏠 Dashboard</button>

        <p style={{ fontSize: "11px", color: "#888", fontWeight: 700, margin: "14px 0 6px 8px" }}>TEAM MANAGEMENT</p>
        <button className={section==="managed_users"?"active":""} onClick={()=>navigate("managed_users")}>👥 Users</button>

        <p style={{ fontSize: "11px", color: "#888", fontWeight: 700, margin: "14px 0 6px 8px" }}>TEAM</p>
        <button className={section==="team_calendar"?"active":""} onClick={()=>navigate("team_calendar")}>📅 Team Calendar</button>
        <button className={section==="team_leads"?"active":""} onClick={()=>navigate("team_leads")}>🎯 Team Leads</button>
        <button className={section==="team_analytics"?"active":""} onClick={()=>navigate("team_analytics")}>📊 Team Analytics</button>
        <button className={section==="team_lob_reasons"?"active":""} onClick={()=>navigate("team_lob_reasons")}>📉 Team LOB Reasons</button>

        <p style={{ fontSize: "11px", color: "#888", fontWeight: 700, margin: "14px 0 6px 8px" }}>MY ZAPPIT</p>
        <button className={section==="activations"?"active":""} onClick={()=>navigate("activations")}>💳 My Card</button>
        <button className={section==="orders"?"active":""} onClick={()=>navigate("orders")}>🛒 My Orders</button>
        <button className={section==="notifications"?"active":""} onClick={()=>navigate("notifications")}>🔔 Notifications</button>

        {identity.role==="SUPER_ADMIN" && <>
          <p style={{ fontSize: "11px", color: "#888", fontWeight: 700, margin: "14px 0 6px 8px" }}>PLATFORM CONTROL</p>
          <button className={section==="admins"?"active":""} onClick={()=>navigate("admins")}>⚙️ Admin Management</button>
          <button className={section==="audit"?"active":""} onClick={()=>navigate("audit")}>🛡️ Audit Logs</button>
          <button className={section==="settings"?"active":""} onClick={()=>navigate("settings")}>🔧 Platform Settings</button>
        </>}
      </nav>
      <button className="admin-logout" onClick={logout}>Log out</button>
    </aside>
    <main><div className="admin-heading"><div><p>ZAPPIT ADMIN DASHBOARD</p><h1>{labels[section]}</h1><span>Manage your team and user accounts.</span></div>{["orders","customers","managed_users","team_leads"].includes(section)&&<form onSubmit={e=>{e.preventDefault();load()}}><input aria-label="Search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"/><button>Search</button></form>}</div>
      {loading?<Skeleton/>:error?<Empty title="Unable to load data" text={error} action={load}/>:<Content section={section} payload={data} identity={identity} mutate={mutate} navigate={navigate} reload={load} openShipOrder={(id: string) => setShipOrderId(id)}/>}
    </main>
  </div>;
}

function Content({section,payload,identity,mutate,navigate,reload,openShipOrder}:{section:Section,payload:any,identity:AdminIdentity,mutate:(p:string,m:string,b:any)=>Promise<any>,navigate:(section:Section)=>void,reload:()=>Promise<void>,openShipOrder:(id:string)=>void}) {
  if(section==="overview") return <Overview data={payload}/>;
  if(section==="managed_users") return <ManagedUsers rows={payload?.users||[]} mutate={mutate} reload={reload} openShipOrder={openShipOrder}/>;
  if(section==="team_calendar") return <TeamCalendar data={payload}/>;
  if(section==="team_leads") return <TeamLeads rows={payload?.leads||[]}/>;
  if(section==="team_analytics") return <TeamAnalytics data={payload}/>;
  if(section==="team_lob_reasons") return <TeamLobReasons rows={payload?.lobReasons||[]}/>;
  const rows:Row[]=payload?.data||[];
  if(section==="orders") return <Orders rows={rows} mutate={mutate}/>;
  if(section==="customers") return <Customers rows={rows} identity={identity} mutate={mutate}/>;
  if(section==="activations") return <Activations rows={rows}/>;
  if(section==="products") return <Products rows={rows} mutate={mutate}/>;
  if(section==="payments") return rows.length?<Table heads={["Provider","Transaction","Amount","Status","Refunded","Date"]} rows={rows.map(r=>[r.provider,r.provider_transaction_id,money(r.amount_minor,r.currency),r.status,money(r.refunded_minor,r.currency),new Date(r.provider_created_at||r.created_at).toLocaleString()])}/>:<Empty title="Payment provider not connected" text="Payment rows will appear after a trusted server webhook writes verified transactions. Refund controls remain disabled until a provider is configured."/>;
  if(section==="support") return <SupportTickets rows={rows} mutate={mutate}/>;
  if(section==="notifications") return <Notifications rows={rows} mutate={mutate} navigate={navigate}/>;
  if(section==="admins") return <Admins rows={rows} identity={identity} mutate={mutate}/>;
  if(section==="audit") return <Table heads={["When","Actor role","Action","Entity","IP"]} rows={rows.map(r=>[new Date(r.created_at).toLocaleString(),r.actor_role,r.action,`${r.entity_type} ${r.entity_id||""}`,r.ip_address||"—"])}/>;
  if(section==="settings") return <Settings value={payload?.data||{}} mutate={mutate}/>;
  return null;
}
function Overview({data}:{data:any}) {
  const s=data.stats||{}; const cards=[["Total orders",s.orders],["Today’s orders",s.todayOrders],["Pending",s.pending],["Processing",s.processing],["Shipped",s.shipped],["Delivered",s.delivered],["Cancelled",s.cancelled],["Refunded",s.refunded],["Total revenue",money(s.revenueTotal,data.currency)],["Revenue this month",money(s.revenueMonth,data.currency)],["Revenue today",money(s.revenueToday,data.currency)],["Customers",s.customers],["New customers",s.newCustomers],["Products",s.products],["Low stock",s.lowStock],["Failed payments",s.failedPayments],["Unread notifications",s.unreadNotifications]];
  return <><section className="stat-grid">{cards.map(([k,v])=><article key={String(k)}><span>{k}</span><strong>{v??0}</strong></article>)}</section><section className="admin-panel"><h2>Orders by status</h2><div className="mini-chart">{(data.charts?.orderStatus||[]).map((r:Row)=><div key={r.label}><span>{r.label}</span><i style={{width:`${Math.max(2,Math.min(100,r.value/Math.max(1,s.orders)*100))}%`}}/><b>{r.value}</b></div>)}</div></section><section className="admin-panel"><h2>Recent orders</h2>{data.recentOrders?.length?<Table heads={["Order","Customer","Status","Payment","Total","Placed"]} rows={data.recentOrders.map((r:Row)=>[r.order_number,r.customer_name,r.status,r.payment_status,money(r.total_minor,r.currency),new Date(r.created_at).toLocaleString()])}/>:<Empty title="No orders yet" text="Verified orders will appear here after your checkout backend creates them."/ >}</section></>;
}
function Orders({rows,mutate}:{rows:Row[],mutate:any}) {
  if(!rows.length)return <Empty title="No matching orders" text="Adjust your search or wait for verified checkout data."/>;
  return <Table heads={["Order","Customer","Products","Delivery","Pricing","Payment","Status","Action"]} rows={rows.map(r=>[<><b>{r.order_number}</b><small>{new Date(r.created_at).toLocaleString()}</small></>,<><b>{r.customer_name}</b><small>{r.customer_email}</small><small>{r.customer_phone||"No phone"}</small></>,<>{r.order_items?.map((item:Row)=><span key={item.id}><b>{item.product_name} × {item.quantity}</b><small>{item.sku||item.product_type} · {money(item.unit_price_minor,r.currency)}</small>{item.variant?.details&&<small>{item.variant.details}</small>}</span>)||"—"}</>,<><b>{[r.shipping_address?.line1,r.shipping_address?.line2].filter(Boolean).join(", ")}</b><small>{[r.shipping_address?.city,r.shipping_address?.state,r.shipping_address?.postalCode,r.shipping_address?.country].filter(Boolean).join(", ")}</small></>,<><b>Total: {money(r.total_minor,r.currency)}</b><small>Subtotal {money(r.subtotal_minor,r.currency)} · Discount {money(r.discount_minor,r.currency)}</small><small>Tax {money(r.tax_minor,r.currency)} · Shipping {money(r.shipping_minor,r.currency)}</small></>,<><b>{r.payment_status}</b><small>{r.payments?.[0]?.provider?.replaceAll("_"," ")||"Not recorded"}</small></>,<span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span>,<select aria-label={`Status for ${r.order_number}`} value={r.status} onChange={e=>confirm(`Change ${r.order_number} to ${e.target.value}?`)&&mutate("orders","PATCH",{id:r.id,status:e.target.value})}>{["PENDING","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"].map(x=><option key={x}>{x}</option>)}</select>])}/>;
}
function SupportTickets({rows,mutate}:{rows:Row[],mutate:any}) {
  const [selected,setSelected]=useState<Row|null>(null),[replyText,setReplyText]=useState(""),[busy,setBusy]=useState(false);
  if(!rows.length)return <Empty title="No support tickets" text="Customer messages submitted through Support will appear here."/>;
  const update=(row:Row,status:string)=>mutate("support","PATCH",{id:row.id,status});
  const statusLabels:Record<string,string>={OPEN:"New problem",IN_PROGRESS:"In progress",WAITING_CUSTOMER:"Waiting for customer",RESOLVED:"Solved",CLOSED:"Not solved"};
  const sendReply=async()=>{if(!selected||replyText.trim().length<2)return;setBusy(true);try{const result=await mutate("support","PATCH",{id:selected.id,reply:replyText.trim(),status:"WAITING_CUSTOMER"});setReplyText("");setSelected(null);if(result.emailDelivered===false)alert("Reply saved in the ticket. Configure RESEND_API_KEY and EMAIL_FROM to email customers automatically.")}catch(error){alert(error instanceof Error?error.message:"Reply could not be saved.")}finally{setBusy(false)}};
  return <><div className="support-summary"><article><small>NEW PROBLEMS</small><strong>{rows.filter(row=>row.status==="OPEN").length}</strong></article><article><small>BEING HANDLED</small><strong>{rows.filter(row=>["IN_PROGRESS","WAITING_CUSTOMER"].includes(row.status)).length}</strong></article><article><small>SOLVED</small><strong>{rows.filter(row=>row.status==="RESOLVED").length}</strong></article><article><small>NOT SOLVED</small><strong>{rows.filter(row=>row.status==="CLOSED").length}</strong></article></div><Table heads={["Problem","Customer","Details","Resolution status","Actions"]} rows={rows.map(row=>[<><b>{row.reference}</b><small>{row.topic}</small><small>{new Date(row.created_at).toLocaleString()}</small></>,<><b>{row.customer_name}</b><small>{row.customer_email}</small><small>{row.contact_time||"No preferred contact time"}</small></>,<><span className="ticket-message-preview">{row.message}</span><small>{row.support_ticket_replies?.length||0} admin replies</small></>,<select aria-label={`Resolution status for ${row.reference}`} value={row.status} onChange={event=>update(row,event.target.value)}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>,<div className="row-actions"><button className="small gold" onClick={()=>setSelected(row)}>View problem</button><button className="small" onClick={()=>mutate("support","PATCH",{id:row.id,assignToMe:true})}>Assign to me</button></div>])}/>{selected&&<div className="admin-modal-back" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null)}}><section className="ticket-detail" role="dialog" aria-modal="true" aria-labelledby="ticket-title"><header><div><small>SUPPORT PROBLEM · {selected.reference}</small><h2 id="ticket-title">{selected.topic}</h2><p>Submitted {new Date(selected.created_at).toLocaleString()}</p></div><button onClick={()=>setSelected(null)} aria-label="Close problem">×</button></header><div className="ticket-customer"><div><small>CUSTOMER</small><strong>{selected.customer_name}</strong></div><div><small>EMAIL</small><a href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a></div><div><small>BEST CONTACT TIME</small><strong>{selected.contact_time||"Not specified"}</strong></div><div><small>STATUS</small><strong>{statusLabels[selected.status]||selected.status}</strong></div></div><div className="ticket-problem"><small>CUSTOMER&apos;S PROBLEM</small><p>{selected.message}</p></div>{selected.support_ticket_replies?.length>0&&<div className="ticket-history"><h3>Reply history</h3>{selected.support_ticket_replies.map((item:Row)=><article key={item.id}><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()} · {item.emailed_at?"Email sent":"Not emailed"}</small></article>)}</div>}<label className="ticket-reply">Reply to customer<textarea value={replyText} onChange={event=>setReplyText(event.target.value)} maxLength={4000} rows={5} placeholder="Explain what you checked and what the customer should do next…"/></label><div className="ticket-actions"><select value={selected.status} onChange={event=>{update(selected,event.target.value);setSelected({...selected,status:event.target.value})}}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><button disabled={busy||replyText.trim().length<2} onClick={sendReply}>{busy?"Sending…":"Send reply"}</button></div></section></div>}</>;
}
function Notifications({rows,mutate,navigate}:{rows:Row[],mutate:any,navigate:(section:Section)=>void}){
  if(!rows.length)return <Empty title="No notifications" text="New orders, support problems, and important business events will appear here."/>;
  const open=async(row:Row)=>{if(!row.read_at)await mutate("notifications","PATCH",{id:row.id,read:true});navigate(row.type==="SUPPORT_TICKET"?"support":row.order_id?"orders":"overview")};
  return <Table heads={["When","Type","What happened","Delivery","Action"]} rows={rows.map(row=>[new Date(row.created_at).toLocaleString(),String(row.type||"GENERAL").replaceAll("_"," "),<><b>{row.title}</b><small>{row.message}</small></>,row.emailed_at?"Email sent":row.email_recipient?"Email pending or failed":"Dashboard only",<button className="small gold" onClick={()=>open(row)}>{row.type==="SUPPORT_TICKET"?"Manage problem":"View details"}</button>])}/>;
}
function Customers({rows,identity,mutate}:{rows:Row[],identity:AdminIdentity,mutate:any}) {
  const [detail,setDetail]=useState<any>(null),[loadingDetail,setLoadingDetail]=useState(false),[detailError,setDetailError]=useState("");
  const open=async(row:Row)=>{setLoadingDetail(true);setDetailError("");setDetail({customer:row,cards:[],orders:[],support:[],affiliate:null});try{const response=await fetch(`/api/admin/customers/${row.id}`,{cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.message||"Customer details could not be loaded.");setDetail(payload)}catch(error){setDetailError(error instanceof Error?error.message:"Customer details could not be loaded.")}finally{setLoadingDetail(false)}};
  if(!rows.length)return <Empty title="No customers found" text="Customer profiles are created from Supabase Auth registrations."/>;
  const sendReset=async(row:Row)=>{if(!confirm(`Send a password-reset email to ${row.email}?`))return;try{const result=await mutate("customers/reset","POST",{id:row.id});alert(result.message||"Password-reset email sent.")}catch(error){alert(error instanceof Error?error.message:"Password-reset email could not be sent.")}};
  const requireChange=async(row:Row)=>{if(!confirm(`Require ${row.email} to change their password at next sign-in?`))return;try{const result=await mutate("customers","PATCH",{id:row.id,forcePasswordReset:true});alert(result.message||"Password change required.")}catch(error){alert(error instanceof Error?error.message:"Password policy could not be updated.")}};
  return <><Table heads={["Customer","Phone","Registered","Status","Action"]} rows={rows.map(r=>[<><b>{r.name||"Unnamed"}</b><small>{r.email}</small></>,r.phone||"—",new Date(r.created_at).toLocaleDateString(),r.disabled?"Disabled":"Active",<div className="row-actions"><button className="small gold" onClick={()=>open(r)}>View details</button><button className="small" onClick={()=>sendReset(r)}>Send reset</button><button className="small" onClick={()=>requireChange(r)}>Require password change</button><button className={r.disabled?"small gold":"small danger"} onClick={()=>confirm(`${r.disabled?"Reactivate":"Disable"} ${r.email}?`)&&mutate("customers","PATCH",{id:r.id,disabled:!r.disabled})}>{r.disabled?"Reactivate":"Disable"}</button>{identity.role==="SUPER_ADMIN"&&<button className="small" onClick={()=>confirm(`Promote ${r.email} to ADMIN?`)&&mutate("admins","PATCH",{id:r.id,role:"ADMIN"})}>Make admin</button>}</div>])}/>{detail&&<CustomerDetail data={detail} loading={loadingDetail} error={detailError} close={()=>setDetail(null)}/>}</>;
}
function CustomerDetail({data,loading,error,close}:{data:any,loading:boolean,error:string,close:()=>void}) {
  const customer = data.customer || {};
  const [qrSlug, setQrSlug] = useState<string | null>(null);
  const [qrTitle, setQrTitle] = useState<string>("");
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");

  const openQr = async (card: Row) => {
    setQrSlug(card.slug);
    setQrTitle(card.profile?.name || card.slug || "Card QR");
    setQrSvg(null);
    setQrError("");
    setQrLoading(true);
    try {
      const response = await fetch(`/api/cards/qr?slug=${encodeURIComponent(card.slug)}`, { cache: "no-store" });
      const text = await response.text();
      if (!response.ok) throw new Error(text || "Could not load QR code.");
      setQrSvg(text);
    } catch (openError) {
      setQrError(openError instanceof Error ? openError.message : "Could not load QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  const closeQr = () => {
    setQrSlug(null);
    setQrSvg(null);
    setQrError("");
    setQrLoading(false);
  };

  const downloadQr = () => {
    if (!qrSvg || !qrSlug) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${qrSlug}-qr.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    if (!qrSvg || !qrSlug) return;
    try {
      const { svgToHighResPngBlob } = await import("@/lib/premiumQr");
      const blob = await svgToHighResPngBlob(qrSvg, 1500);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${qrSlug}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert("Could not generate PNG download.");
    }
  };

  const cardUrl = qrSlug ? getPublicCardUrl(qrSlug) : "";

  return (
    <div className="admin-modal-back" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="customer-detail" role="dialog" aria-modal="true" aria-labelledby="customer-detail-title">
        <header>
          <div>
            <small>CUSTOMER RECORD</small>
            <h2 id="customer-detail-title">{customer.name || "Unnamed customer"}</h2>
            <p>{customer.email}</p>
          </div>
          <button onClick={close} aria-label="Close customer details">×</button>
        </header>

        {loading ? <Skeleton /> : error ? <Empty title="Unable to load customer" text={error} /> : <>
          <div className="customer-facts">
            {[["Account ID", customer.id], ["Name", customer.name || "Not provided"], ["Email", customer.email], ["Phone", customer.phone || "Not provided"], ["Account status", customer.disabled ? "Disabled" : customer.status || "Active"], ["Registered", customer.created_at ? new Date(customer.created_at).toLocaleString() : "—"], ["Last profile update", customer.updated_at ? new Date(customer.updated_at).toLocaleString() : "—"], ["Password", "Securely hashed — never viewable"]].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <h3>Digital cards ({data.cards?.length || 0})</h3>
          {data.cards?.length ? <Table heads={["Card", "Profile information", "Activation", "Published", "Updated", "QR"]} rows={data.cards.map((card: Row) => ([
            <><b>{card.profile?.name || card.slug}</b><small>/card/{card.slug}</small></>,
            <><span>{card.profile?.title || "No title"}{card.profile?.business ? ` · ${card.profile.business}` : ""}</span><small>{card.profile?.email || "No public email"} · {card.profile?.mobile || "No public phone"}</small><small>{[card.profile?.city, card.profile?.state, card.profile?.countryIso].filter(Boolean).join(", ") || "No location"}</small></>,
            card.activated_at ? "Activated" : "Not activated",
            card.active && card.activated_at ? "Yes" : "No",
            new Date(card.updated_at).toLocaleString(),
            <button className="small gold" type="button" onClick={() => openQr(card)}>View QR</button>
          ]))} /> : <p className="detail-empty">No digital cards.</p>}

          <h3>Orders ({data.orders?.length || 0})</h3>
          {data.orders?.length ? <Table heads={["Order", "Items", "Payment", "Status", "Total", "Placed"]} rows={data.orders.map((order: Row) => ([order.order_number, order.order_items?.map((item: Row) => `${item.product_name} × ${item.quantity}`).join(", ") || "—", order.payment_status, order.status, money(order.total_minor, order.currency), new Date(order.created_at).toLocaleString()]))} /> : <p className="detail-empty">No orders.</p>}

          <h3>Support ({data.support?.length || 0})</h3>
          {data.support?.length ? <Table heads={["Reference", "Topic", "Status", "Created"]} rows={data.support.map((ticket: Row) => ([ticket.reference, ticket.topic, ticket.status, new Date(ticket.created_at).toLocaleString()]))} /> : <p className="detail-empty">No support tickets.</p>}

          <h3>Affiliate account</h3>
          <p className="detail-empty">{data.affiliate ? `${data.affiliate.partner_type} · ${data.affiliate.status} · Code ${data.affiliate.affiliate_code}` : "Not enrolled in the affiliate program."}</p>
          {customer.internal_notes && <><h3>Internal notes</h3><p className="detail-empty">{customer.internal_notes}</p></>}
        </>}

        {qrSlug && (
          <div className="admin-modal-back" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQr(); }}>
            <section className="customer-qr-modal" role="dialog" aria-modal="true" aria-labelledby="customer-qr-title">
              <header>
                <div>
                  <small>CARD QR CODE</small>
                  <h2 id="customer-qr-title">{qrTitle}</h2>
                  <p>{cardUrl}</p>
                </div>
                <button onClick={closeQr} aria-label="Close QR modal">×</button>
              </header>
              <div className="customer-qr-body">
                <div className="customer-qr-img">
                  {qrLoading ? <span className="customer-qr-loading">Generating…</span> : qrSvg ? <div dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <span className="customer-qr-error">{qrError || "QR code unavailable."}</span>}
                </div>
                <div className="customer-qr-actions">
                  {qrError ? <button type="button" className="small gold" onClick={() => { if (qrSlug) { openQr({ slug: qrSlug, profile: { name: qrTitle } } as Row); } }} disabled={qrLoading}>Try again</button> : <>
                    <button type="button" className="small gold" onClick={downloadPng} disabled={!qrSvg || qrLoading}>Download PNG</button>
                    <button type="button" className="small gold" onClick={downloadQr} disabled={!qrSvg || qrLoading}>Download SVG</button>
                  </>}
                  <a className="small" href={cardUrl} target="_blank" rel="noopener noreferrer">Open card</a>
                </div>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
function Activations({rows}:{rows:Row[]}) {
  const [assigned,setAssigned]=useState<{slug:string;email:string}|null>(null);
  const [busy,setBusy]=useState("");
  const [issued,setIssued]=useState<string[]>([]);
  const generate=async(customer:Row)=>{
    if(!confirm(`Provision and assign physical card for ${customer.email}?`))return;
    setBusy(customer.id);setAssigned(null);
    try{
      const response=await fetch("/api/admin/cards/activation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ownerId:customer.id})});
      const result=await response.json();if(!response.ok)throw new Error(result.message||"Could not assign card.");
      setAssigned({slug:result.slug,email:customer.email||"Customer account"});
      setIssued(current=>current.includes(customer.id)?current:[...current,customer.id]);
    }catch(error){alert(error instanceof Error?error.message:"Could not assign card.")}finally{setBusy("")}
  };
  if(!rows.length)return <Empty title="No customers yet" text="Customer accounts will appear here after registration."/>;
  return <>
    <section className="activation-guide"><div><span>FULFILLMENT WORKFLOW</span><h2>Provision &amp; assign customer card</h2><p>Assign a physical NFC / QR card directly to the customer account. The card is instantly linked to their digital profile and ready to ship.</p></div>{assigned&&<div className="activation-result" role="status"><small>CARD READY FOR SHIPPING</small><strong>/{assigned.slug}</strong><span>Assigned holder: {assigned.email}</span><span>Status: ASSIGNED &amp; READY</span><p>This card is linked to the customer account and ready to deliver.</p></div>}</section>
    <div className="table-wrap activation-table"><table><thead><tr><th>Customer</th><th>Account</th><th>Fulfillment Status</th><th>Action</th></tr></thead><tbody>{rows.map(customer=>{const codeIssued=issued.includes(customer.id);return <tr key={customer.id}><td data-label="Customer"><b>{customer.name||"Unnamed customer"}</b><small>{customer.email}</small></td><td data-label="Account"><b>{customer.disabled?"Account disabled":"Customer account"}</b><small>Digital card linked and ready</small></td><td data-label="Status"><span className="pill">{customer.disabled?"Disabled":codeIssued?"Card assigned":"Ready for card"}</span></td><td data-label="Action"><button className="small gold" disabled={Boolean(busy)||customer.disabled} onClick={()=>generate(customer)}>{busy===customer.id?"Assigning…":"Provision & assign card"}</button></td></tr>})}</tbody></table></div>
  </>;
}
function Products({rows,mutate}:{rows:Row[],mutate:any}) {
  const create=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);await mutate("products","POST",{name:f.get("name"),productType:f.get("type"),priceMinor:Math.round(Number(f.get("price"))*100),stock:Number(f.get("stock"))});e.currentTarget.reset()};
  return <><form className="quick-form" onSubmit={create}><h2>Add product</h2><input name="name" required placeholder="Product name"/><select name="type"><option value="NFC_CARD">NFC card</option><option value="QR_LOST_FOUND">QR lost & found</option><option value="ACCESSORY">Accessory</option><option value="OTHER">Other</option></select><input name="price" required type="number" min="0" step=".01" placeholder="Price"/><input name="stock" required type="number" min="0" placeholder="Stock"/><button>Add product</button></form>{rows.length?<Table heads={["Product","Type","SKU","Price","Stock","Status","Action"]} rows={rows.map(r=>[r.name,r.product_type,r.sku||"—",money(r.price_minor,r.currency),r.stock,r.archived_at?"Archived":r.active?"Active":"Inactive",<button className="small" onClick={()=>mutate("products","PATCH",{id:r.id,archived:!r.archived_at})}>{r.archived_at?"Restore":"Archive"}</button>])}/>:<Empty title="No products" text="Create your first database-backed product above."/>}</>;
}
function Admins({rows,identity,mutate}:{rows:Row[],identity:AdminIdentity,mutate:any}) {
  const invite=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const result=await mutate("admins","POST",{email:f.get("email")});alert(result.message);e.currentTarget.reset()};
  return <><form className="quick-form" onSubmit={invite}><h2>Invite an administrator</h2><input name="email" type="email" required placeholder="admin@example.com"/><button>Record invite</button></form><Table heads={["Administrator","Role","Created","Status","Action"]} rows={rows.map(r=>[<><b>{r.name}</b><small>{r.email}</small></>,r.role,new Date(r.created_at).toLocaleDateString(),r.disabled?"Disabled":"Active",r.id===identity.id||r.role==="SUPER_ADMIN"?"Protected":<div className="row-actions"><button className="small danger" onClick={()=>confirm(`Change access for ${r.email}?`)&&mutate("admins","PATCH",{id:r.id,disabled:!r.disabled})}>{r.disabled?"Reactivate":"Disable"}</button><button className="small" onClick={()=>confirm(`Remove ADMIN role from ${r.email}?`)&&mutate("admins","PATCH",{id:r.id,role:"CUSTOMER"})}>Remove role</button></div>])}/></>;
}
function ManagedUsers({rows,mutate,reload,openShipOrder}:{rows:Row[],mutate:any,reload:()=>Promise<void>,openShipOrder:(id:string)=>void}) {
  const [showCreate,setShowCreate]=useState(false);
  const [selectedUser,setSelectedUser]=useState<Row|null>(null);
  const [qrModalUser,setQrModalUser]=useState<Row|null>(null);
  const [detailsData,setDetailsData]=useState<any|null>(null);
  const [detailsLoading,setDetailsLoading]=useState(false);
  const [ordersModalData,setOrdersModalData]=useState<any|null>(null);
  const [ordersLoading,setOrdersLoading]=useState(false);
  const [creating,setCreating]=useState(false);
  const [updating,setUpdating]=useState(false);
  const [copyNotice,setCopyNotice]=useState("");

  const featureList: Array<{key: string; label: string}> = [
    {key:"dashboard",label:"Dashboard"},
    {key:"profile",label:"Profile"},
    {key:"nfc_card",label:"NFC Card"},
    {key:"qr_profile",label:"QR Profile"},
    {key:"crm",label:"CRM"},
    {key:"leads",label:"Leads"},
    {key:"lost_found",label:"Lost & Found"},
    {key:"vehicle",label:"Vehicle"},
    {key:"orders",label:"Orders"},
    {key:"analytics",label:"Analytics"},
    {key:"products",label:"Products"},
    {key:"notifications",label:"Notifications"},
  ];

  const copyToClipboard = (text: string, label: string) => {
    if (!text || text === "Not provided") return;
    navigator.clipboard.writeText(text);
    setCopyNotice(`Copied ${label}!`);
    setTimeout(() => setCopyNotice(""), 2000);
  };

  const openDetailsModal = async (user: Row) => {
    setDetailsLoading(true);
    setDetailsData(null);
    try {
      const res = await fetch(`/api/admin/managed-users/${user.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load user details");
      const json = await res.json();
      setDetailsData(json);
    } catch (e: any) {
      alert(e.message || "Could not load user details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const openOrdersModal = async (user: Row) => {
    setOrdersLoading(true);
    setOrdersModalData(null);
    try {
      const res = await fetch(`/api/admin/managed-users/${user.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load user orders");
      const json = await res.json();
      setOrdersModalData(json);
    } catch (e: any) {
      alert(e.message || "Could not load user orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  const downloadUserQr = async (user: Row, format: "png" | "svg") => {
    const qrUrl = user.qrUrl || getCanonicalUserQrUrl({ slug: user.digital_card_slug, id: user.id });
    const svgString = buildPremiumQrSvg(qrUrl, { label: "3G ZAPPIT" });
    const filename = `zappit-qr-${user.name ? user.name.replace(/\s+/g, "-").toLowerCase() : user.id}.${format}`;

    if (format === "svg") {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = await svgToHighResPngBlob(svgString, 1500);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const createUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    try {
      const f = new FormData(e.currentTarget);
      const name = String(f.get("name") || "").trim();
      const email = String(f.get("email") || "").trim();
      const password = String(f.get("password") || "").trim();
      const status = String(f.get("status") || "ACTIVE");

      const response = await fetch("/api/admin/managed-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: password || undefined, status }),
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || "Failed to create user.");
      alert("User created successfully!");
      setShowCreate(false);
      await reload();
    } catch (err: any) {
      alert(err.message || "Could not create user.");
    } finally {
      setCreating(false);
    }
  };

  const savePermissions = async (user: Row, newPermissions: Record<string, boolean>) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/managed-users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featurePermissions: newPermissions }),
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || "Failed to update permissions.");
      alert("User feature permissions updated successfully.");
      setSelectedUser(null);
      await reload();
    } catch (err: any) {
      alert(err.message || "Failed to save permissions.");
    } finally {
      setUpdating(false);
    }
  };

  const changeStatus = async (user: Row, newStatus: string) => {
    if (!confirm(`Change ${user.email} status to ${newStatus}?`)) return;
    try {
      const response = await fetch(`/api/admin/managed-users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.message || "Failed to update status.");
      await reload();
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    }
  };

  return (
    <>
      {copyNotice && (
        <div style={{ position: "fixed", top: "20px", right: "20px", background: "#52c41a", color: "#000", padding: "10px 20px", borderRadius: "6px", fontWeight: 700, zIndex: 9999 }}>
          ✓ {copyNotice}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2>Managed Users ({rows.length})</h2>
          <p style={{ fontSize: "13px", color: "#888" }}>Users created by and assigned to your Admin account.</p>
        </div>
        <button className="gold" onClick={() => setShowCreate(true)} style={{ padding: "8px 16px" }}>
          + Create User
        </button>
      </div>

      {!rows.length ? (
        <Empty title="No managed users yet" text="Click '+ Create User' to assign your first user account." />
      ) : (
        <Table
          heads={["User", "Role", "Status", "Created", "Actions"]}
          rows={rows.map((user) => [
            <>
              <b>{user.name || "Unnamed"}</b>
              <small>{user.email}</small>
            </>,
            <span className="pill">{user.role === "CUSTOMER" ? "USER" : user.role}</span>,
            <span className={`pill ${user.status?.toLowerCase()}`}>{user.status}</span>,
            new Date(user.created_at).toLocaleDateString(),
            <div className="row-actions">
              <button className="small gold" onClick={() => setQrModalUser(user)}>
                QR
              </button>
              <button className="small gold" onClick={() => openDetailsModal(user)}>
                Details
              </button>
              <button className="small gold" onClick={() => openOrdersModal(user)}>
                Orders
              </button>
              <button className="small" onClick={() => setSelectedUser(user)}>
                Permissions
              </button>
              {user.status === "ACTIVE" ? (
                <button className="small danger" onClick={() => changeStatus(user, "SUSPENDED")}>
                  Suspend
                </button>
              ) : (
                <button className="small gold" onClick={() => changeStatus(user, "ACTIVE")}>
                  Activate
                </button>
              )}
            </div>,
          ])}
        />
      )}

      {/* CREATE USER MODAL */}
      {showCreate && (
        <div className="admin-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <section className="customer-detail" role="dialog" style={{ maxWidth: "500px" }}>
            <header>
              <div>
                <small>ADMIN ACTION</small>
                <h2>Create New User Account</h2>
                <p>New user will be automatically assigned to your Admin account (role = USER).</p>
              </div>
              <button onClick={() => setShowCreate(false)}>×</button>
            </header>
            <form onSubmit={createUser} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "20px 0" }}>
              <label>
                Full Name
                <input name="name" required placeholder="User Full Name" style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
              </label>
              <label>
                Email Address
                <input name="email" type="email" required placeholder="user@example.com" style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
              </label>
              <label>
                Password (Optional - user can sign in or reset)
                <input name="password" type="password" placeholder="Min 12 chars" style={{ width: "100%", padding: "8px", marginTop: "4px" }} />
              </label>
              <label>
                Initial Account Status
                <select name="status" defaultValue="ACTIVE" style={{ width: "100%", padding: "8px", marginTop: "4px" }}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ padding: "8px 16px" }}>
                  Cancel
                </button>
                <button className="gold" disabled={creating} type="submit" style={{ padding: "8px 16px" }}>
                  {creating ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* QR MODAL */}
      {qrModalUser && (() => {
        const qrUrl = qrModalUser.qrUrl || getCanonicalUserQrUrl({ slug: qrModalUser.digital_card_slug, id: qrModalUser.id });
        const cardUrl = getPublicCardUrl(qrModalUser.digital_card_slug || qrModalUser.id);
        return (
          <div className="admin-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setQrModalUser(null)}>
            <section className="customer-detail" role="dialog" style={{ maxWidth: "420px", textAlign: "center" }}>
              <header>
                <div>
                  <small>USER QR CODE</small>
                  <h2>{qrModalUser.name || qrModalUser.email}</h2>
                  <p style={{ wordBreak: "break-all", fontSize: "11px" }}>{qrUrl}</p>
                </div>
                <button onClick={() => setQrModalUser(null)}>×</button>
              </header>
              <div style={{ padding: "20px 0" }}>
                <div
                  dangerouslySetInnerHTML={{ __html: buildPremiumQrSvg(qrUrl, { label: "3G ZAPPIT" }) }}
                  style={{ width: "220px", height: "220px", margin: "0 auto 16px", background: "#050505", padding: "8px", borderRadius: "10px", border: "1px solid #333" }}
                />
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="small gold" onClick={() => downloadUserQr(qrModalUser, "png")}>Download PNG</button>
                  <button className="small gold" onClick={() => downloadUserQr(qrModalUser, "svg")}>Download SVG</button>
                  <button className="small" onClick={() => copyToClipboard(qrUrl, "QR URL")}>Copy QR URL</button>
                  <a className="small" href={cardUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "4px 8px", background: "#222", color: "#0066FF", border: "1px solid #333", borderRadius: "4px", textDecoration: "none" }}>
                    Open Profile
                  </a>
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {/* DETAILS DRAWER */}
      {(detailsData || detailsLoading) && (
        <div className="admin-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setDetailsData(null)}>
          <section className="customer-detail" role="dialog" style={{ maxWidth: "600px", maxHeight: "90vh", overflowY: "auto" }}>
            <header>
              <div>
                <small>CUSTOMER &amp; SHIPPING DETAILS</small>
                <h2>{detailsData?.user?.name || "Customer Details"}</h2>
                <p>{detailsData?.user?.email}</p>
              </div>
              <button onClick={() => setDetailsData(null)}>×</button>
            </header>

            {detailsLoading ? (
              <p style={{ padding: "20px" }}>Loading details...</p>
            ) : (
              <div style={{ padding: "16px 0", fontSize: "13px", lineHeight: "1.6" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  <button className="small gold" onClick={() => copyToClipboard(
                    [
                      detailsData.shippingAddress?.recipientName,
                      detailsData.shippingAddress?.phone ? `Phone: ${detailsData.shippingAddress.phone}` : "",
                      detailsData.shippingAddress?.house,
                      detailsData.shippingAddress?.street,
                      detailsData.shippingAddress?.locality,
                      `${detailsData.shippingAddress?.city || ""} ${detailsData.shippingAddress?.state || ""} ${detailsData.shippingAddress?.pinCode || ""}`,
                      detailsData.shippingAddress?.country
                    ].filter(Boolean).join(", "),
                    "Full Address"
                  )}>
                    Copy Address
                  </button>
                  <button className="small gold" onClick={() => copyToClipboard(detailsData.profile?.phone || detailsData.shippingAddress?.phone || "Not provided", "Phone")}>
                    Copy Phone
                  </button>
                  <button className="small gold" onClick={() => copyToClipboard(detailsData.user?.email || "Not provided", "Email")}>
                    Copy Email
                  </button>
                </div>

                <div style={{ background: "#111", padding: "12px", borderRadius: "6px", marginBottom: "14px", border: "1px solid #222" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#d4af37" }}>CUSTOMER INFORMATION</h4>
                  <div><strong>Full Name:</strong> {detailsData.user?.name || "Not provided"}</div>
                  <div><strong>Email:</strong> {detailsData.user?.email || "Not provided"}</div>
                  <div><strong>Phone:</strong> {detailsData.profile?.phone || detailsData.user?.phone || "Not provided"}</div>
                  <div><strong>Alternate Phone:</strong> {detailsData.shippingAddress?.alternatePhone || "Not provided"}</div>
                </div>

                {detailsData.digitalCard && (
                  <div style={{ background: "#111", padding: "12px", borderRadius: "6px", marginBottom: "14px", border: "1px solid #222" }}>
                    <h4 style={{ margin: "0 0 8px", color: "#2ecc71" }}>🟢 PROFILE &amp; FEATURE VISIBILITY</h4>
                    <div><strong>Profile Status:</strong> <span style={{ color: detailsData.digitalCard.active ? "#2ecc71" : "#e74c3c", fontWeight: 700 }}>{detailsData.digitalCard.active ? "LIVE" : "HIDDEN / DISABLED"}</span></div>
                    <div><strong>Public URL:</strong> <a href={getPublicCardUrl(detailsData.digitalCard.slug)} target="_blank" rel="noopener noreferrer" style={{ color: "#00E5FF" }}>/card/{detailsData.digitalCard.slug}</a></div>
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                      <strong>Active Features State:</strong>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 6 }}>
                        {Object.entries(detailsData.digitalCard.profile?.profileFeatures || { BASIC_PROFILE: { enabled: true }, CONTACT: { enabled: true } }).map(([featKey, cfg]: [string, any]) => (
                          <div key={featKey} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 4 }}>
                            <span>{featKey.replace("_", " ")}</span>
                            <span style={{ color: cfg?.enabled !== false ? "#2ecc71" : "#e74c3c", fontWeight: 700 }}>{cfg?.enabled !== false ? "ON" : "OFF"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ background: "#111", padding: "12px", borderRadius: "6px", border: "1px solid #222" }}>
                  <h4 style={{ margin: "0 0 8px", color: "#0066FF" }}>SHIPPING INFORMATION</h4>
                  <div><strong>Recipient Name:</strong> {detailsData.shippingAddress?.recipientName || "Not provided"}</div>
                  <div><strong>Phone:</strong> {detailsData.shippingAddress?.phone || "Not provided"}</div>
                  <div><strong>Alternate Phone:</strong> {detailsData.shippingAddress?.alternatePhone || "Not provided"}</div>
                  <div><strong>House / Building:</strong> {detailsData.shippingAddress?.house || "Not provided"}</div>
                  <div><strong>Street:</strong> {detailsData.shippingAddress?.street || "Not provided"}</div>
                  <div><strong>Locality:</strong> {detailsData.shippingAddress?.locality || "Not provided"}</div>
                  <div><strong>City:</strong> {detailsData.shippingAddress?.city || "Not provided"}</div>
                  <div><strong>District:</strong> {detailsData.shippingAddress?.district || "Not provided"}</div>
                  <div><strong>State:</strong> {detailsData.shippingAddress?.state || "Not provided"}</div>
                  <div><strong>PIN Code:</strong> {detailsData.shippingAddress?.pinCode || "Not provided"}</div>
                  <div><strong>Country:</strong> {detailsData.shippingAddress?.country || "Not provided"}</div>
                  <div><strong>Delivery Instructions:</strong> {detailsData.shippingAddress?.deliveryInstructions || "Not provided"}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ORDERS MODAL */}
      {(ordersModalData || ordersLoading) && (
        <div className="admin-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOrdersModalData(null)}>
          <section className="customer-detail" role="dialog" style={{ maxWidth: "750px" }}>
            <header>
              <div>
                <small>USER ORDERS</small>
                <h2>{ordersModalData?.user?.name || "User Orders"}</h2>
                <p>{ordersModalData?.user?.email}</p>
              </div>
              <button onClick={() => setOrdersModalData(null)}>×</button>
            </header>

            {ordersLoading ? (
              <p style={{ padding: "20px" }}>Loading orders...</p>
            ) : ordersModalData?.orders?.length === 0 ? (
              <p style={{ padding: "20px", color: "#888" }}>No orders placed by this user yet.</p>
            ) : (
              <div style={{ padding: "16px 0", overflowX: "auto" }}>
                <Table
                  heads={["Order #", "Date", "Amount", "Payment", "Order Status", "Card Status", "Tracking / AWB", "Action"]}
                  rows={ordersModalData?.orders?.map((o: any) => [
                    <b>#{o.orderNumber}</b>,
                    new Date(o.createdAt).toLocaleDateString(),
                    `₹${(o.totalMinor / 100).toFixed(2)}`,
                    <span style={{ color: o.paymentStatus === "PAID" ? "#52c41a" : "#ff4d4f", fontWeight: 600 }}>{o.paymentStatus}</span>,
                    <span className="pill">{o.status}</span>,
                    <span className="pill">{o.cardStatus}</span>,
                    o.trackingNumber ? `${o.courier || "Courier"}: ${o.trackingNumber}` : "Not Dispatched",
                    <button
                      className="small gold"
                      onClick={() => {
                        setOrdersModalData(null);
                        openShipOrder(o.id);
                      }}
                    >
                      Open Order
                    </button>
                  ])}
                />
              </div>
            )}
          </section>
        </div>
      )}

      {/* PERMISSIONS MODAL */}
      {selectedUser && (
        <div className="admin-modal-back" onMouseDown={(e) => e.target === e.currentTarget && setSelectedUser(null)}>
          <section className="customer-detail" role="dialog" style={{ maxWidth: "550px" }}>
            <header>
              <div>
                <small>FEATURE PERMISSIONS</small>
                <h2>{selectedUser.name || selectedUser.email}</h2>
                <p>Toggle feature access for this user. Disabled features return 403 server-side.</p>
              </div>
              <button onClick={() => setSelectedUser(null)}>×</button>
            </header>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formEl = e.currentTarget;
                const permissions: Record<string, boolean> = {};
                featureList.forEach((f) => {
                  const inputEl = formEl.elements.namedItem(`perm_${f.key}`) as HTMLInputElement | null;
                  permissions[f.key] = inputEl ? inputEl.checked : false;
                });
                savePermissions(selectedUser, permissions);
              }}
              style={{ padding: "20px 0" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                {featureList.map((f) => {
                  const currentPermissions = selectedUser.feature_permissions || {};
                  const isChecked = currentPermissions[f.key] !== false;
                  return (
                    <label key={f.key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer" }}>
                      <input type="checkbox" name={`perm_${f.key}`} defaultChecked={isChecked} style={{ width: "18px", height: "18px" }} />
                      <span>{f.label}</span>
                    </label>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setSelectedUser(null)} style={{ padding: "8px 16px" }}>
                  Cancel
                </button>
                <button className="gold" disabled={updating} type="submit" style={{ padding: "8px 16px" }}>
                  {updating ? "Saving..." : "Save Feature Permissions"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function TeamCalendar({ data }: { data: any }) {
  const followUps: Row[] = data?.followUps || [];
  const teamLeadCounts: Row[] = data?.teamLeadCounts || [];
  const [filterUser, setFilterUser] = useState<string>("ALL");

  const filteredFollowUps = filterUser === "ALL" 
    ? followUps 
    : followUps.filter((f) => f.user_id === filterUser);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2>Team Calendar &amp; Activity</h2>
          <p style={{ fontSize: "13px", color: "#888" }}>Monitor scheduled follow-ups and lead submission counts across your assigned team.</p>
        </div>
        <div>
          <label style={{ fontSize: "13px", marginRight: "8px" }}>Filter User:</label>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ padding: "6px 12px", background: "#111", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
            <option value="ALL">All Managed Users</option>
            {teamLeadCounts.map((u) => (
              <option key={u.user_id} value={u.user_id}>{u.user_name || u.user_email}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {teamLeadCounts.map((user) => (
          <div key={user.user_id} style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
            <strong style={{ fontSize: "15px" }}>{user.user_name || "Unnamed User"}</strong>
            <div style={{ color: "#888", fontSize: "12px", marginBottom: "10px" }}>{user.user_email}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #222", paddingTop: "8px" }}>
              <span style={{ fontSize: "12px", color: "#aaa" }}>Leads Today</span>
              <strong style={{ fontSize: "18px", color: "#d4af37" }}>{user.leads_today || 0}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
              <span style={{ fontSize: "12px", color: "#aaa" }}>Total Leads</span>
              <span style={{ fontSize: "14px", fontWeight: 600 }}>{user.total_leads || 0}</span>
            </div>
          </div>
        ))}
      </div>

      <h3>Scheduled Follow-Ups &amp; Meetings</h3>
      {!filteredFollowUps.length ? (
        <Empty title="No scheduled team follow-ups" text="Follow-ups scheduled by your team members will appear here." />
      ) : (
        <Table
          heads={["Scheduled", "User", "Lead", "Contact", "Note / Purpose", "Status"]}
          rows={filteredFollowUps.map((f) => [
            new Date(f.scheduled_at).toLocaleString(),
            <><b>{f.user_name || "Unnamed"}</b><small>{f.user_email}</small></>,
            <><b>{f.lead_name}</b><small>{f.company_name || "No Company"}</small></>,
            f.contact_number || "—",
            f.note || "General Follow-up",
            <span className={`pill ${f.status?.toLowerCase()}`}>{f.status}</span>,
          ])}
        />
      )}
    </>
  );
}

function TeamLeads({ rows }: { rows: Row[] }) {
  const [filterUser, setFilterUser] = useState("ALL");
  const [filterStage, setFilterStage] = useState("ALL");

  const uniqueUsers = Array.from(new Set(rows.map((r) => r.user_id))).map((id) => {
    const row = rows.find((r) => r.user_id === id);
    return { id, name: row?.user_name || row?.user_email };
  });

  const filtered = rows.filter((r) => {
    if (filterUser !== "ALL" && r.user_id !== filterUser) return false;
    if (filterStage !== "ALL" && r.status !== filterStage) return false;
    return true;
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2>Team Leads ({filtered.length})</h2>
          <p style={{ fontSize: "13px", color: "#888" }}>Leads captured across all accounts assigned to your Admin profile.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ padding: "6px 12px", background: "#111", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
            <option value="ALL">All Users</option>
            {uniqueUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} style={{ padding: "6px 12px", background: "#111", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
            <option value="ALL">All Stages</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="INTERESTED">Interested</option>
            <option value="FOLLOW_UP">Follow-up</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      </div>

      {!filtered.length ? (
        <Empty title="No matching team leads" text="Leads submitted by your managed team members will appear here." />
      ) : (
        <Table
          heads={["Assigned User", "Lead Name", "Company", "Contact", "Source", "Stage", "Created Date"]}
          rows={filtered.map((l) => [
            <><b>{l.user_name || "Unnamed"}</b><small>{l.user_email}</small></>,
            <b>{l.name}</b>,
            l.company_name || "—",
            <><div>{l.contact_number}</div><small>{l.email || ""}</small></>,
            l.source || "DIRECT",
            <span className={`pill ${l.status?.toLowerCase()}`}>{l.status}</span>,
            new Date(l.created_at).toLocaleDateString(),
          ])}
        />
      )}
    </>
  );
}

function TeamAnalytics({ data }: { data: any }) {
  const totals = data?.totals || { total_leads: 0, leads_today: 0, leads_week: 0, leads_month: 0, converted_leads: 0, lost_leads: 0 };
  const userBreakdown: Row[] = data?.userBreakdown || [];

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <h2>Team Performance Analytics</h2>
        <p style={{ fontSize: "13px", color: "#888" }}>Aggregated performance statistics for users under your Admin scope.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
          <span style={{ color: "#888", fontSize: "12px" }}>Total Team Leads</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0" }}>{totals.total_leads}</h2>
        </div>
        <div style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
          <span style={{ color: "#888", fontSize: "12px" }}>Leads Today</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0", color: "#d4af37" }}>{totals.leads_today}</h2>
        </div>
        <div style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
          <span style={{ color: "#888", fontSize: "12px" }}>This Week</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0" }}>{totals.leads_week}</h2>
        </div>
        <div style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
          <span style={{ color: "#888", fontSize: "12px" }}>This Month</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0" }}>{totals.leads_month}</h2>
        </div>
        <div style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
          <span style={{ color: "#888", fontSize: "12px" }}>Converted</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0", color: "#52c41a" }}>{totals.converted_leads}</h2>
        </div>
        <div style={{ background: "#141414", border: "1px solid #262626", padding: "16px", borderRadius: "8px" }}>
          <span style={{ color: "#888", fontSize: "12px" }}>Lost</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0", color: "#ff4d4f" }}>{totals.lost_leads}</h2>
        </div>
      </div>

      <h3>Per-User Performance Breakdown</h3>
      {!userBreakdown.length ? (
        <Empty title="No team analytics data" text="Per-user metrics will populate as your managed team captures leads." />
      ) : (
        <Table
          heads={["Team Member", "Total Leads", "Converted", "Lost", "Conversion Rate %"]}
          rows={userBreakdown.map((u) => {
            const convRate = u.total_leads > 0 ? Math.round((u.converted_leads / u.total_leads) * 100) : 0;
            return [
              <><b>{u.user_name || "Unnamed"}</b><small>{u.user_email}</small></>,
              u.total_leads,
              <span style={{ color: "#52c41a", fontWeight: 700 }}>{u.converted_leads}</span>,
              <span style={{ color: "#ff4d4f", fontWeight: 700 }}>{u.lost_leads}</span>,
              <strong>{convRate}%</strong>,
            ];
          })}
        />
      )}
    </>
  );
}

function TeamLobReasons({ rows }: { rows: Row[] }) {
  const totalLost = rows.reduce((acc, r) => acc + Number(r.count || 0), 0);

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <h2>Team LOB Reasons</h2>
        <p style={{ fontSize: "13px", color: "#888" }}>Identify patterns and exit reasons why your managed users are losing leads.</p>
      </div>

      {!rows.length ? (
        <Empty title="No LOB reasons recorded yet" text="LOB reasons selected by team members when marking leads as Lost will appear here." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ background: "#141414", border: "1px solid #262626", padding: "20px", borderRadius: "8px" }}>
            <h3 style={{ marginBottom: "16px" }}>LOB Reason Frequency Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {rows.map((r) => {
                const count = Number(r.count || 0);
                const pct = totalLost > 0 ? Math.round((count / totalLost) * 100) : 0;
                return (
                  <div key={r.reason}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <strong>{r.reason}</strong>
                      <span>{count} ({pct}%)</span>
                    </div>
                    <div style={{ background: "#222", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ background: "#d4af37", height: "100%", width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Table
            heads={["LOB Reason", "Lost Count", "Percentage"]}
            rows={rows.map((r) => {
              const count = Number(r.count || 0);
              const pct = totalLost > 0 ? Math.round((count / totalLost) * 100) : 0;
              return [r.reason, count, `${pct}%`];
            })}
          />
        </div>
      )}
    </>
  );
}

function Settings({value,mutate}:{value:Row,mutate:any}) { const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));return mutate("settings","PATCH",{...f,low_stock_threshold:Number(f.low_stock_threshold)})}; return <form className="settings-form" onSubmit={save}>{[["business_name","Business name"],["support_email","Support email"],["support_phone","Support phone"],["order_notification_email","Order notification email"],["currency","Currency"],["low_stock_threshold","Low-stock threshold"],["terms_url","Terms URL"],["privacy_url","Privacy URL"],["maintenance_message","Maintenance message"]].map(([name,label])=><label key={name}>{label}<input name={name} defaultValue={value[name]??""}/></label>)}<button>Save settings</button><p>Secrets and environment variables are intentionally never displayed here.</p></form> }
function Table({heads,rows}:{heads:string[],rows:any[][]}) { return <div className="table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div> }
function Empty({title,text,action}:{title:string,text:string,action?:()=>void}) { return <section className="empty"><strong>{title}</strong><p>{text}</p>{action&&<button onClick={action}>Try again</button>}</section> }
function Skeleton(){return <div className="skeleton">{[1,2,3,4,5,6].map(x=><i key={x}/>)}</div>}


