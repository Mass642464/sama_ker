import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { getPropertyCatalog } from "@/lib/public-properties";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl().origin;
  const paths = ["", "/terrains", "/immobilier", "/carte", "/services", "/a-propos", "/contact", "/faq", "/actualites", "/diaspora", "/zone/thies", "/zone/dakar"];
  const { properties } = await getPropertyCatalog();
  const listings = properties.filter((property) => !property.isDemo).map((property) => ({
    url: `${baseUrl}/${property.category === "terrain" ? "terrains" : "immobilier"}/${property.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [
    ...paths.map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" as const : "monthly" as const, priority: path === "" ? 1 : 0.7 })),
    ...listings,
  ];
}