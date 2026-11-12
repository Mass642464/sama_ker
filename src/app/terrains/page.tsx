import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog-view";
import { filterProperties, type PropertySearchParams } from "@/lib/properties";
import { paginate, parsePage } from "@/lib/pagination";
import { getPropertyCatalog } from "@/lib/public-properties";

export const metadata: Metadata = { title: "Terrains à vendre au Sénégal", description: "Découvrez notre sélection de terrains au Sénégal et échangez avec notre équipe pour en savoir plus." };

export default async function TerrainsPage({ searchParams }: { searchParams: Promise<PropertySearchParams> }) {
  const params = await searchParams;
  const { properties, isDemo } = await getPropertyCatalog();
  const catalog = properties.filter((property) => property.category === "terrain");
  const regions = [...new Set(catalog.map((property) => property.region))].sort((left, right) => left.localeCompare(right, "fr"));
  const filtered = filterProperties(catalog, params);
  const pageResult = paginate(filtered, parsePage(params.page));
  return <CatalogView title="Terrains à découvrir" intro="Trouvez un terrain qui correspond à votre projet, avec un accompagnement ancré dans les réalités du territoire." properties={pageResult.items} kind="terrain" isDemo={isDemo} regions={regions} {...params} pagination={{ page: pageResult.page, pageCount: pageResult.pageCount, total: pageResult.total, basePath: "/terrains", params }}/>;
}
