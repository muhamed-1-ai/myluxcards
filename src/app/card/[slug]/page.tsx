import PublicCardClient from "./PublicCardClient";
import "./public-card.css";

export default async function PublicCard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicCardClient slug={slug} />;
}
