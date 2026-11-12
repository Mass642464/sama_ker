import { ImageResponse } from "next/og";
import { getPublicProperties } from "@/lib/public-properties";

export async function GET(_request: Request, { params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  if (category !== "terrains" && category !== "immobilier") return new Response("Annonce introuvable.", { status: 404 });
  const property = (await getPublicProperties()).find((item) =>
    item.slug === slug && !item.isDemo && item.category === (category === "terrains" ? "terrain" : "immobilier"));
  if (!property) return new Response("Annonce introuvable.", { status: 404 });

  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#f5f1e8", padding: 64, color: "#174c38" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: "#8a6835" }}>SAMA KËR · ANNONCE PUBLIÉE</div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 53, fontWeight: 700, lineHeight: 1.15 }}>{property.title.slice(0, 100)}</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: "#52655b" }}>{property.location.slice(0, 100)}</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 45, fontWeight: 700 }}>{property.priceLabel.slice(0, 80)}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "2px solid #c59b52", paddingTop: 22, fontSize: 24 }}>
        <span>Réf. {property.ref.slice(0, 80)}</span><span style={{ color: "#52655b" }}>Informations à confirmer</span>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } },
  );
}
