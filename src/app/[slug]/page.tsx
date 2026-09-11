import { notFound } from "next/navigation";
import PublicCardClient from "../card/[slug]/PublicCardClient";
import "../card/[slug]/public-card.css";

const RESERVED_SLUGS = new Set([
  "acceptable-use",
  "account",
  "admin",
  "affiliate",
  "api",
  "card",
  "cookie-policy",
  "corporate",
  "dashboard",
  "find",
  "forbidden",
  "login",
  "notifications",
  "orders",
  "partners",
  "privacy",
  "privacy-policy",
  "products",
  "refunds",
  "reset-password",
  "shipping",
  "super-admin",
  "support",
  "terms",
  "terms-of-service",
]);

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cleanSlug = String(slug || "").toLowerCase().trim();

  if (!cleanSlug || RESERVED_SLUGS.has(cleanSlug)) {
    notFound();
  }

  return <PublicCardClient slug={cleanSlug} />;
}
