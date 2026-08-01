"use client";
import { useEffect, useState } from "react";

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-IN", { style:"currency", currency:currency || "INR" }).format((minor || 0) / 100);

export default function OrdersClient() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/orders").then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.message); setOrders(payload.data || []); }).catch(error => setError(error.message || "Orders could not be loaded.")).finally(() => setLoading(false)); }, []);
  return <main className="orders-page"><header><a href="/dashboard">← Dashboard</a><span>MYLUXCARDS</span></header><section className="orders-hero"><p>YOUR ACCOUNT</p><h1>My orders</h1><span>Track purchases, payments, delivery, and invoices.</span></section>{loading ? <div className="orders-state">Loading your orders…</div> : error ? <div className="orders-state error">{error}</div> : !orders.length ? <div className="orders-state"><h2>No orders yet</h2><p>Your purchases will appear here after checkout.</p><a href="/#card-configurator">Design your first card</a></div> : <section className="orders-list">{orders.map(order => <article key={order.id}><div className="order-top"><div><small>ORDER</small><h2>{order.order_number}</h2><p>{new Date(order.created_at).toLocaleString()}</p></div><div className="badges"><b>{order.status}</b><b className={`payment ${order.payment_status?.toLowerCase()}`}>{order.payment_status}</b></div></div><div className="order-items">{order.order_items?.map((item:any) => <p key={item.id}><span>{item.product_name} × {item.quantity}</span><strong>{money(item.total_minor, order.currency)}</strong></p>)}</div><div className="order-bottom"><div><small>TOTAL</small><strong>{money(order.total_minor, order.currency)}</strong>{order.tracking_number && <span>{order.courier || "Courier"}: {order.tracking_number}</span>}</div><a href={`/api/orders/${order.id}/invoice`} target="_blank" rel="noreferrer">View invoice</a></div></article>)}</section>}</main>;
}
