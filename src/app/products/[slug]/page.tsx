import { notFound } from "next/navigation";
import { supabaseJson } from "@/lib/supabaseAuth";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: any = null;
  try {
    const { data } = await supabaseJson(
      `/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&active=eq.true&archived_at=is.null&select=id,name,slug,description,product_type,price_minor,sale_price_minor,currency,stock,images&limit=1`,
      {},
      true,
    );
    product = data?.[0];
  } catch { /* Unconfigured product data is presented as not found. */ }
  if (!product) notFound();
  const price = product.sale_price_minor ?? product.price_minor;
  return <main style={{minHeight:"100vh",background:"#050505",color:"#fff",padding:"70px 7vw",fontFamily:"'Inter',sans-serif"}}>
    <a href="/" style={{color:"#00D9FF",fontWeight:700}}>← Zappit</a>
    <article style={{maxWidth:850,margin:"55px auto",padding:32,border:"1px solid rgba(0,102,255,0.25)",borderRadius:16,background:"#080B12"}}>
      <small style={{color:"#00D9FF",letterSpacing:2,fontWeight:700}}>{String(product.product_type).replaceAll("_"," ")}</small>
      <h1 style={{fontSize:"clamp(36px,7vw,64px)",margin:"14px 0",fontFamily:"'Outfit',sans-serif"}}>{product.name}</h1>
      <p style={{color:"#94a3b8",lineHeight:1.7,fontSize:18}}>{product.description || "Product details are being prepared."}</p>
      <strong style={{display:"block",fontSize:28,margin:"28px 0"}}>{new Intl.NumberFormat("en-IN",{style:"currency",currency:product.currency}).format(price/100)}</strong>
      <p>{product.stock > 0 ? "Available" : "Currently unavailable"}</p>
      <a href="/#featured-categories-section" style={{display:"inline-block",background:"linear-gradient(135deg, #0066FF, #0057FF)",color:"#ffffff",padding:"13px 18px",borderRadius:8,fontWeight:800,textDecoration:"none"}}>View products</a>
    </article>
  </main>;
}
