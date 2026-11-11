import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { PropertyMapExplorer, type ExplorerProperty } from "@/components/property-map-explorer";
import { getPropertyCatalog } from "@/lib/public-properties";

export const metadata: Metadata = {
  title: "Carte des biens",
  description: "Explorez le Sénégal sur une carte Google Maps : les biens dont la zone a été validée sont repérés de façon approximative.",
};

export default async function MapPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { properties, isDemo } = await getPropertyCatalog();
  const query = q.trim().toLocaleLowerCase("fr");
  const visibleProperties = properties.filter((property) =>
    !query || `${property.title} ${property.location}`.toLocaleLowerCase("fr").includes(query),
  );
  const regions = [...new Set(properties.map((property) => property.region))].sort((left, right) => left.localeCompare(right, "fr"));
  const explorerProperties: ExplorerProperty[] = visibleProperties.map((property) => ({
    slug: property.slug,
    title: property.title,
    location: property.location,
    region: property.region,
    area: property.area,
    priceLabel: property.priceLabel,
    status: property.status,
    isDemo: property.isDemo,
    href: `/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`,
    ...(property.coordinates ? { coordinates: property.coordinates } : {}),
  }));

  return (
    <PageShell>
      <section className="container py-6 sm:py-10">
        <div className="mb-5">
          <span className="eyebrow">Explorer Sama Kër</span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#172a26] sm:text-4xl">Carte des biens</h1>
          <p className="mt-1.5 text-xs text-[#777e79] sm:text-sm">Repérez une région, centrez la carte sur votre position et retrouvez les biens les plus proches.</p>
        </div>
        <PropertyMapExplorer properties={explorerProperties} regions={regions} query={q} isDemo={isDemo}/>
      </section>
    </PageShell>
  );
}
