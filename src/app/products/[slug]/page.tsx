import { notFound } from "next/navigation";
import { findActiveProductBySlug } from "@/lib/repositories/products";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: any = null;
  try {
    product = await findActiveProductBySlug(slug);
  } catch { /* Unconfigured product data is presented as not found. */ }
  if (!product) notFound();
  const price = product.sale_price_minor ?? product.price_minor;
  return <main style={{minHeight:"100vh",background:"#080808",color:"#fff",padding:"70px 7vw",fontFamily:"Arial,sans-serif"}}>
    <a href="/" style={{color:"#d6b859"}}>← MyLuxCards</a>
    <article style={{maxWidth:850,margin:"55px auto",padding:32,border:"1px solid #333",borderRadius:16,background:"#111"}}>
      <small style={{color:"#d6b859",letterSpacing:2}}>{String(product.product_type).replaceAll("_"," ")}</small>
      <h1 style={{fontSize:"clamp(36px,7vw,64px)",margin:"14px 0"}}>{product.name}</h1>
      <p style={{color:"#bbb",lineHeight:1.7,fontSize:18}}>{product.description || "Product details are being prepared."}</p>
      <strong style={{display:"block",fontSize:28,margin:"28px 0"}}>{new Intl.NumberFormat("en-IN",{style:"currency",currency:product.currency}).format(price/100)}</strong>
      <p>{product.stock > 0 ? "Available" : "Currently unavailable"}</p>
      <a href="/#products" style={{display:"inline-block",background:"#d6b859",color:"#080808",padding:"13px 18px",borderRadius:8,fontWeight:800,textDecoration:"none"}}>View products</a>
    </article>
  </main>;
}
