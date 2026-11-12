import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { PropertyMapExplorer, type ExplorerProperty } from "@/components/property-map-explorer";
import { getPropertyCatalog } from "@/lib/public-properties";
import { filterProperties, type PropertySearchParams } from "@/lib/properties";

export const metadata: Metadata = {
  title: "Carte des biens",
  description: "Explorez le Sénégal sur une carte Google Maps : les biens dont la zone a été validée sont repérés de façon approximative.",
};

export default async function MapPage({ searchParams }: { searchParams: Promise<PropertySearchParams & { category?: string }> }) {
  const params = await searchParams;
  const { q = "" } = params;
  const { properties, isDemo } = await getPropertyCatalog();
  const visibleProperties = filterProperties(properties.filter((property) => !params.category || property.category === params.category), params);
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
    property,
    href: `/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`,
    ...(property.coordinates ? { coordinates: property.coordinates } : {}),
  }));

  return (
    <PageShell>
      <section className="container py-8 sm:py-12">
        <div className="mb-5">
          <span className="eyebrow">Explorer Sama Kër</span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#174c38] sm:text-4xl">Explorer les biens sur la carte</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#626d66]">Une lecture territoriale de votre recherche, avec des positions volontairement approximatives.</p>
        </div>
        <PropertyMapExplorer properties={explorerProperties} regions={regions} query={q} isDemo={isDemo} filters={params}/>
      </section>
    </PageShell>
  );
}
