"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { AdminIdentity } from "@/lib/adminAuth";

type Section = "overview"|"orders"|"customers"|"activations"|"products"|"payments"|"notifications"|"admins"|"audit"|"settings";
type Row = Record<string, any>;
const labels: Record<Section,string> = { overview:"Overview",orders:"Orders",customers:"Customers",activations:"Card activation",products:"Products",payments:"Payments",notifications:"Notifications",admins:"Admin management",audit:"Audit logs",settings:"Settings" };
const money = (minor=0,currency="INR") => new Intl.NumberFormat("en-IN",{style:"currency",currency}).format(minor/100);

export default function AdminApp({ identity }:{identity:AdminIdentity}) {
  const [section,setSection]=useState<Section>("overview"), [mobile,setMobile]=useState(false);
  const [data,setData]=useState<any>(null), [loading,setLoading]=useState(true), [error,setError]=useState(""), [search,setSearch]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    const path=section==="overview"?"dashboard":section==="activations"?"cards/activation":section;
    try { const response=await fetch(`/api/admin/${path}${search&&["orders","customers"].includes(section)?`?search=${encodeURIComponent(search)}`:""}`,{cache:"no-store"});
      if(response.status===403){window.location.replace("/forbidden");return}
      if(!response.ok) throw new Error((await response.json()).message||"Request failed.");
      setData(await response.json());
    } catch(e){setError(e instanceof Error?e.message:"Could not load this section.")} finally{setLoading(false)}
  },[section,search]);
  useEffect(()=>{load()},[load]);
  const mutate=async(path:string,method:string,body:unknown)=>{
    const response=await fetch(`/api/admin/${path}`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json(); if(!response.ok) throw new Error(result.message||"Request failed."); await load(); return result;
  };
  const navigate=(next:Section)=>{setSection(next);setSearch("");setMobile(false)};
  const logout=async()=>{await fetch("/api/auth/logout",{method:"POST"});localStorage.removeItem("myluxcards_current_user");window.location.replace("/")};
  const allowed=(Object.keys(labels) as Section[]).filter(item=>identity.role==="SUPER_ADMIN"||!["admins","audit","settings"].includes(item));
  return <div className="admin-shell">
    <header className="admin-top"><button className="admin-menu" onClick={()=>setMobile(!mobile)}>☰</button><a href="/" className="admin-logo">MYLUX<span>CARDS</span></a><div><strong>{identity.name}</strong><small>{identity.role.replace("_"," ")}</small></div></header>
    {mobile&&<button className="admin-scrim" onClick={()=>setMobile(false)} aria-label="Close menu"/>}
    <aside className={mobile?"open":""}><p>CONTROL CENTRE</p><nav>{allowed.map(item=><button key={item} className={section===item?"active":""} onClick={()=>navigate(item)}>{labels[item]}</button>)}<a href="/admin/affiliates">Affiliate program</a></nav><button className="admin-logout" onClick={logout}>Log out</button></aside>
    <main><div className="admin-heading"><div><p>MYLUX ADMINISTRATION</p><h1>{labels[section]}</h1><span>Secure, real-time business operations.</span></div>{["orders","customers"].includes(section)&&<form onSubmit={e=>{e.preventDefault();load()}}><input aria-label="Search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"/><button>Search</button></form>}</div>
      {loading?<Skeleton/>:error?<Empty title="Unable to load data" text={error} action={load}/>:<Content section={section} payload={data} identity={identity} mutate={mutate}/>}
    </main>
  </div>;
}

function Content({section,payload,identity,mutate}:{section:Section,payload:any,identity:AdminIdentity,mutate:(p:string,m:string,b:any)=>Promise<any>}) {
  if(section==="overview") return <Overview data={payload}/>;
  const rows:Row[]=payload?.data||[];
  if(section==="orders") return <Orders rows={rows} mutate={mutate}/>;
  if(section==="customers") return <Customers rows={rows} identity={identity} mutate={mutate}/>;
  if(section==="activations") return <Activations rows={rows}/>;
  if(section==="products") return <Products rows={rows} mutate={mutate}/>;
  if(section==="payments") return rows.length?<Table heads={["Provider","Transaction","Amount","Status","Refunded","Date"]} rows={rows.map(r=>[r.provider,r.provider_transaction_id,money(r.amount_minor,r.currency),r.status,money(r.refunded_minor,r.currency),new Date(r.provider_created_at||r.created_at).toLocaleString()])}/>:<Empty title="Payment provider not connected" text="Payment rows will appear after a trusted server webhook writes verified transactions. Refund controls remain disabled until a provider is configured."/>;
  if(section==="notifications") return rows.length?<Table heads={["When","Notification","Email","Action"]} rows={rows.map(r=>[new Date(r.created_at).toLocaleString(),<><b>{r.title}</b><small>{r.message}</small></>,r.emailed_at?"Sent":"Not sent",<button className="small" disabled={Boolean(r.read_at)} onClick={()=>mutate("notifications","PATCH",{id:r.id,read:true})}>{r.read_at?"Read":"Mark read"}</button>])}/>:<Empty title="No notifications" text="Idempotent order notifications will appear here when a trusted checkout or payment webhook creates them." />;
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
  return <Table heads={["Order","Customer","Placed","Total","Payment","Status","Action"]} rows={rows.map(r=>[r.order_number,<><b>{r.customer_name}</b><small>{r.customer_email}</small></>,new Date(r.created_at).toLocaleString(),money(r.total_minor,r.currency),r.payment_status,<span className={`pill ${r.status.toLowerCase()}`}>{r.status}</span>,<select aria-label={`Status for ${r.order_number}`} value={r.status} onChange={e=>confirm(`Change ${r.order_number} to ${e.target.value}?`)&&mutate("orders","PATCH",{id:r.id,status:e.target.value})}>{["PENDING","CONFIRMED","PROCESSING","SHIPPED","DELIVERED","CANCELLED","REFUNDED"].map(x=><option key={x}>{x}</option>)}</select>])}/>;
}
function Customers({rows,identity,mutate}:{rows:Row[],identity:AdminIdentity,mutate:any}) {
  if(!rows.length)return <Empty title="No customers found" text="Customer profiles are created from Supabase Auth registrations."/>;
  return <Table heads={["Customer","Phone","Registered","Status","Action"]} rows={rows.map(r=>[<><b>{r.name||"Unnamed"}</b><small>{r.email}</small></>,r.phone||"—",new Date(r.created_at).toLocaleDateString(),r.disabled?"Disabled":"Active",<div className="row-actions"><button className={r.disabled?"small gold":"small danger"} onClick={()=>confirm(`${r.disabled?"Reactivate":"Disable"} ${r.email}?`)&&mutate("customers","PATCH",{id:r.id,disabled:!r.disabled})}>{r.disabled?"Reactivate":"Disable"}</button>{identity.role==="SUPER_ADMIN"&&<button className="small" onClick={()=>confirm(`Promote ${r.email} to ADMIN?`)&&mutate("admins","PATCH",{id:r.id,role:"ADMIN"})}>Make admin</button>}</div>])}/>;
}
function Activations({rows}:{rows:Row[]}) {
  const [code,setCode]=useState<{value:string;slug:string;owner:string;email:string}|null>(null);
  const [busy,setBusy]=useState("");
  const [issued,setIssued]=useState<string[]>([]);
  const generate=async(card:Row)=>{
    const replacing=card.hasActivationCode||card.activated_at;
    if(replacing&&!confirm(`Replace the activation code for ${card.owner?.email||card.slug}? The card will be inactive until the new code is entered.`))return;
    setBusy(card.id);setCode(null);
    try{
      const response=await fetch("/api/admin/cards/activation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cardId:card.id})});
      const result=await response.json();if(!response.ok)throw new Error(result.message||"Could not generate code.");
      setCode({value:result.activationCode,slug:result.slug,owner:card.owner?.name||card.owner?.email||"Customer",email:card.owner?.email||"Unknown account"});
      setIssued(current=>current.includes(card.id)?current:[...current,card.id]);
    }catch(error){alert(error instanceof Error?error.message:"Could not generate code.")}finally{setBusy("")}
  };
  if(!rows.length)return <Empty title="No customer cards yet" text="A customer card will appear here after the customer creates it in their dashboard."/>;
  return <>
    <section className="activation-guide"><div><span>HOW IT WORKS</span><h2>Generate or reset a customer’s code</h2><p>You can reset a card’s activation code whenever needed. Codes are tied to the customer account and exact card shown in the same row—they cannot be activated while signed in to a different account.</p></div>{code&&<div className="activation-result" role="status"><small>NEW CODE FOR {code.owner.toUpperCase()}</small><strong>{code.value}</strong><span>Customer login: {code.email}</span><span>Card: /card/{code.slug}</span><button onClick={async()=>{await navigator.clipboard.writeText(code.value);alert("Activation code copied.")}}>Copy code</button><p>Send this code to the customer shown above. For security, the full code cannot be viewed again.</p></div>}</section>
    <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Card</th><th>Status</th><th>Code</th><th>Action</th></tr></thead><tbody>{rows.map(card=>{const hasCode=card.hasActivationCode||issued.includes(card.id);const wasActivated=Boolean(card.activated_at);const canReset=hasCode||wasActivated;return <tr key={card.id}><td><b>{card.owner?.name||"Unnamed customer"}</b><small>{card.owner?.email||card.owner_id}</small></td><td><b>{card.slug}</b><small>/card/{card.slug}</small></td><td><span className="pill">{issued.includes(card.id)?"Awaiting activation":card.active&&wasActivated?"Active":wasActivated?"Inactive":"Not activated"}</span></td><td>{hasCode?"Code issued":wasActivated?"Code used":"Not generated"}</td><td><button className="small gold" disabled={Boolean(busy)} onClick={()=>generate({...card,hasActivationCode:canReset})}>{busy===card.id?"Generating…":canReset?"Reset code":"Generate code"}</button></td></tr>})}</tbody></table></div>
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
function Settings({value,mutate}:{value:Row,mutate:any}) { const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));return mutate("settings","PATCH",{...f,low_stock_threshold:Number(f.low_stock_threshold)})}; return <form className="settings-form" onSubmit={save}>{[["business_name","Business name"],["support_email","Support email"],["support_phone","Support phone"],["order_notification_email","Order notification email"],["currency","Currency"],["low_stock_threshold","Low-stock threshold"],["terms_url","Terms URL"],["privacy_url","Privacy URL"],["maintenance_message","Maintenance message"]].map(([name,label])=><label key={name}>{label}<input name={name} defaultValue={value[name]??""}/></label>)}<button>Save settings</button><p>Secrets and environment variables are intentionally never displayed here.</p></form> }
function Table({heads,rows}:{heads:string[],rows:any[][]}) { return <div className="table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div> }
function Empty({title,text,action}:{title:string,text:string,action?:()=>void}) { return <section className="empty"><strong>{title}</strong><p>{text}</p>{action&&<button onClick={action}>Try again</button>}</section> }
function Skeleton(){return <div className="skeleton">{[1,2,3,4,5,6].map(x=><i key={x}/>)}</div>}
