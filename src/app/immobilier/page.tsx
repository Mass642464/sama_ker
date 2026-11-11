import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog-view";
import { filterProperties, type PropertySearchParams } from "@/lib/properties";
import { paginate, parsePage } from "@/lib/pagination";
import { getPropertyCatalog } from "@/lib/public-properties";

export const metadata: Metadata = { title: "Maisons, appartements et locations", description: "Parcourez une sélection de biens immobiliers au Sénégal, à vendre ou à louer." };

export default async function ImmobilierPage({ searchParams }: { searchParams: Promise<PropertySearchParams> }) {
  const params = await searchParams;
  const { properties, isDemo } = await getPropertyCatalog();
  const filtered = filterProperties(properties.filter((property) => property.category === "immobilier"), params);
  const pageResult = paginate(filtered, parsePage(params.page));
  return <CatalogView title="Immobilier au Sénégal" intro="Maisons, appartements et opportunités immobilières : explorez les biens et échangez avec un conseiller pour organiser une visite." properties={pageResult.items} kind="immobilier" isDemo={isDemo} {...params} pagination={{ page: pageResult.page, pageCount: pageResult.pageCount, total: pageResult.total, basePath: "/immobilier", params }}/>;
}
