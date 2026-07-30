"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";

type View = "overview" | "referrals" | "links" | "materials" | "payouts";
const money = (minor = 0, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);

export default function AffiliateDashboard({ view = "overview" }: { view?: View }) {
  const [data, setData] = useState<any>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/affiliate/dashboard", { cache: "no-store" }); const result = await response.json();
    if (!response.ok) setError(result.message || "Could not load dashboard."); else setData(result);
  }, []);
  useEffect(() => { load(); }, [load]);
  if (error) return <main className="affiliate-section"><div className="affiliate-message affiliate-error">{error}</div></main>;
  if (!data) return <main className="affiliate-section"><div className="affiliate-panel">Loading affiliate data…</div></main>;
  if (!data.profile) return <main className="affiliate-section"><div className="affiliate-panel"><h1>Become a MyLuxCards affiliate</h1><p>You have not submitted an affiliate application.</p><a className="affiliate-button" href="/affiliate/apply">Apply now</a></div></main>;
  if (data.profile.status !== "APPROVED") return <main className="affiliate-section"><div className="affiliate-panel"><div className="affiliate-kicker">Application status</div><h1>{formatStatus(data.profile.status)}</h1><p>{data.profile.rejectionReason || statusMessage(data.profile.status)}</p><ol className="application-timeline" aria-label="Partner application progress"><li className="complete"><span>1</span><div><strong>Application received</strong><small>Your application was saved securely.</small></div></li><li className={data.profile.status === "PENDING" ? "current" : "complete"}><span>2</span><div><strong>Administrator review</strong><small>{data.profile.status === "PENDING" ? "Your information is awaiting review." : "The review has been completed."}</small></div></li><li className={["REJECTED", "DISABLED", "SUSPENDED"].includes(data.profile.status) ? "stopped" : ""}><span>3</span><div><strong>Referral tools activated</strong><small>Approved partners receive dashboard and campaign access.</small></div></li></ol>{["REJECTED", "DISABLED"].includes(data.profile.status) && <a className="affiliate-button" href="/affiliate/apply">Submit a new application</a>}</div></main>;
  const appUrl = data.appUrl || (typeof window === "undefined" ? "" : window.location.origin);
  const referralUrl = `${appUrl}/?ref=${encodeURIComponent(data.profile.affiliateCode)}`;
  return <main className="affiliate-dashboard">
    <div className="affiliate-dashboard-head"><div><div className="affiliate-kicker">Affiliate dashboard</div><h1>Welcome back</h1><p>Code: <strong>{data.profile.affiliateCode}</strong> · Tier: <strong>{data.profile.tier || "Starter"}</strong></p></div><a className="affiliate-button secondary" href="/">View store</a></div>
    <nav className="affiliate-tabs">{(["overview", "referrals", "links", "materials", "payouts"] as View[]).map(item => <a key={item} href={`/partners/dashboard${item === "overview" ? "" : `/${item}`}`}>{item[0].toUpperCase() + item.slice(1)}</a>)}{data.profile.partnerType==="BUSINESS_PARTNER"&&<a href="/partners/dashboard/leads">Leads</a>}</nav>
    {view === "overview" && <Overview data={data} referralUrl={referralUrl}/>}
    {view === "referrals" && <Referrals data={data}/>}
    {view === "links" && <Links data={data} reload={load} busy={busy} setBusy={setBusy}/>}
    {view === "materials" && <Materials data={data}/>}
    {view === "payouts" && <Payouts data={data} reload={load} busy={busy} setBusy={setBusy}/>}
  </main>;
}

function Overview({ data, referralUrl }: any) {
  const s = data.stats;
  const stats = [["Total clicks", s.totalClicks], ["Unique visitors", s.uniqueVisitors], ["Referred orders", s.totalOrders], ["Conversion rate", `${s.conversionRate.toFixed(1)}%`], ["Referred revenue", money(s.referredRevenueMinor, data.currency)], ["Pending commission", money(s.pendingCommissionMinor, data.currency)], ["Approved commission", money(s.approvedCommissionMinor, data.currency)], ["Paid commission", money(s.paidCommissionMinor, data.currency)], ["Available payout", money(s.availablePayoutMinor, data.currency)], ["Delivered orders", s.deliveredOrders], ["Cancelled orders", s.cancelledOrders], ["Reversed commission", money(s.reversedCommissionMinor, data.currency)]];
  if(data.profile.partnerType==="CUSTOMER_REFERRER"){stats.push(["Available store credit",money(data.credits.filter((x:any)=>x.status==="AVAILABLE").reduce((n:number,x:any)=>n+Number(x.amount_minor),0),data.currency)],["Pending rewards",money(data.credits.filter((x:any)=>x.status==="PENDING").reduce((n:number,x:any)=>n+Number(x.amount_minor),0),data.currency)],["Used rewards",money(data.credits.filter((x:any)=>x.status==="USED").reduce((n:number,x:any)=>n+Number(x.amount_minor),0),data.currency)])}
  const daily = groupClicks(data.clicks);
  return <><section className="affiliate-panel"><h2>Your referral link</h2><CopyRow value={referralUrl}/><p><a className="affiliate-button secondary" href="/api/affiliate/qr?destination=%2F">Download referral QR</a></p>{data.profile.couponCode && <p>Coupon: <strong>{data.profile.couponCode}</strong></p>}</section>
    <section className="affiliate-stats">{stats.map(([label, value]) => <article className="affiliate-stat" key={label as string}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <div className="affiliate-two"><section className="affiliate-panel"><h2>Clicks over the last 14 days</h2><div className="affiliate-chart">{daily.map((count, i) => <i key={i} title={`${count} clicks`} style={{ height: `${Math.max(3, count / Math.max(1, ...daily) * 100)}%` }}/>)}</div></section><section className="affiliate-panel"><h2>Program settings</h2><p>Attribution: {data.settings.attribution_window_days} days</p><p>Holding period: {data.settings.holding_period_days} days</p><p>Minimum payout: {money(data.settings.minimum_payout_minor, data.currency)}</p></section></div></>;
}
function Referrals({ data }: any) {
  const commissionByOrder = new Map(data.commissions.map((item: any) => [item.order_id, item]));
  return <section className="affiliate-panel"><h2>Your referred orders</h2><p><a className="affiliate-button secondary" href="/api/affiliate/export">Download CSV report</a></p>{data.orders.length ? <div className="affiliate-table-wrap"><table className="affiliate-table"><thead><tr>{["Order", "Date", "Customer", "Product", "Order status", "Eligible amount", "Commission", "Status", "Source"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data.orders.map((order: any) => { const commission: any = commissionByOrder.get(order.id); return <tr key={order.id}><td>{order.order_number}</td><td>{new Date(order.created_at).toLocaleDateString()}</td><td>{order.customer_name}<br/><small>{order.customer_email}</small></td><td>{order.order_items?.map((x:any)=>x.product_name).join(", ") || "—"}</td><td>{order.status}</td><td>{money(commission?.commissionable_minor || 0, order.currency)}</td><td>{money(commission?.commission_minor || 0, order.currency)}</td><td><span className="affiliate-pill">{commission?.status || "TRACKED"}</span></td><td>{commission?.referral_source || order.affiliate_source || "—"}</td></tr>; })}</tbody></table></div> : <p>No referred orders yet.</p>}</section>;
}
function Links({ data, reload, busy, setBusy }: any) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/affiliate/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    if (!response.ok) alert((await response.json()).message); else { event.currentTarget.reset(); await reload(); } setBusy(false);
  }
  async function toggle(id:string,active:boolean){setBusy(true);const response=await fetch("/api/affiliate/campaigns",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,active})});if(!response.ok)alert((await response.json()).message);await reload();setBusy(false)}
  const origin = data.appUrl || (typeof window === "undefined" ? "" : window.location.origin);
  return <><form className="affiliate-panel affiliate-fields" onSubmit={create}><label>Campaign name<input name="name" required maxLength={80}/></label><label>Source label<input name="source" maxLength={80} placeholder="instagram"/></label><label className="wide">Destination<select name="destinationPath"><option value="/">Home page</option>{data.products.map((p:any)=><option key={p.id} value={`/products/${p.slug}`}>{p.name}</option>)}</select></label><button disabled={busy}>Create safe link</button></form>
    <section className="affiliate-panel"><h2>Campaign links</h2>{data.campaigns.length ? data.campaigns.map((campaign:any) => { const value = `${origin}${campaign.destination_path}?${new URLSearchParams({ ref:data.profile.affiliateCode,campaign:campaign.name,...(campaign.source?{source:campaign.source}:{}) })}`; const qr=`/api/affiliate/qr?${new URLSearchParams({destination:campaign.destination_path,campaign:campaign.name,...(campaign.source?{source:campaign.source}:{})})}`; return <article key={campaign.id}><p><strong>{campaign.name}</strong> · {campaign.active ? "Active" : "Disabled"} · {campaign.clicks} clicks · {campaign.uniqueVisitors} unique · {campaign.conversions} conversions · {money(campaign.revenueMinor,data.currency)}</p><CopyRow value={value}/><p><a className="affiliate-button secondary" href={qr}>Download QR</a> <button type="button" disabled={busy} onClick={()=>toggle(campaign.id,!campaign.active)}>{campaign.active?"Disable":"Enable"}</button></p></article>; }) : <p>No campaigns created yet.</p>}</section></>;
}
function Materials({ data }: any) {
  return <section className="affiliate-grid">{data.materials.length ? data.materials.map((item:any)=><article className="affiliate-card" key={item.id}><span className="affiliate-pill">{item.material_type}</span><h2>{item.title}</h2><p>{item.description}</p>{item.promotional_text&&<textarea readOnly value={item.promotional_text} rows={4}/>} {item.storage_url&&<a className="affiliate-button secondary" href={item.storage_url} target="_blank" rel="noreferrer">Open asset</a>}</article>) : <article className="affiliate-panel"><h2>No promotional materials yet</h2><p>Administrator-approved assets will appear here.</p></article>}</section>;
}
function Payouts({ data, reload, busy, setBusy }: any) {
  async function requestPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!confirm("Reserve all approved commissions for this payout request?")) return;
    setBusy(true); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/affiliate/payouts", { method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(form.entries()))});
    const result=await response.json(); if(!response.ok) alert(result.message); else {event.currentTarget.reset();await reload();} setBusy(false);
  }
  return <><section className="affiliate-stats"><article className="affiliate-stat"><span>Available balance</span><strong>{money(data.stats.availablePayoutMinor,data.currency)}</strong></article><article className="affiliate-stat"><span>Minimum payout</span><strong>{money(data.settings.minimum_payout_minor,data.currency)}</strong></article></section>
    <form className="affiliate-panel affiliate-fields" onSubmit={requestPayout}><h2 className="wide">Request payout</h2><label>Method<select name="method"><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="PAYPAL">PayPal</option><option value="OTHER">Other</option></select></label><label>Payout details<input name="details" required maxLength={500} autoComplete="off" placeholder="UPI ID or account instructions"/></label><p className="wide">Details are encrypted at rest and masked outside the payout workflow.</p><button disabled={busy}>Request payout</button></form>
    <section className="affiliate-panel"><h2>Payout history</h2>{data.payouts.length?<div className="affiliate-table-wrap"><table className="affiliate-table"><thead><tr>{["Requested","Amount","Method","Status","Paid","Reference"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data.payouts.map((p:any)=><tr key={p.id}><td>{new Date(p.requested_at).toLocaleDateString()}</td><td>{money(p.amount_minor,p.currency)}</td><td>{p.payout_method}</td><td>{p.status}</td><td>{p.paid_at?new Date(p.paid_at).toLocaleDateString():"—"}</td><td>{p.transaction_reference||"—"}</td></tr>)}</tbody></table></div>:<p>No payout requests yet.</p>}</section></>;
}
function CopyRow({ value }: { value: string }) { return <div className="copy-row"><input readOnly value={value}/><button onClick={() => navigator.clipboard.writeText(value)} type="button">Copy</button></div>; }
function statusMessage(status:string){return status==="PENDING"?"Your application is awaiting administrator review.":status==="SUSPENDED"?"Your affiliate account is suspended and cannot earn new commissions.":"Your affiliate account is not active."}
function formatStatus(status:string){return status.toLowerCase().replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase())}
function groupClicks(clicks:any[]){const days=Array.from({length:14},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(13-i));return d});return days.map(day=>clicks.filter(x=>{const d=new Date(x.created_at);return d>=day&&d<new Date(day.getTime()+86400000)}).length)}
