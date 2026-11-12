import type { Property } from "./properties";

type ShareProperty = Pick<Property, "slug" | "category" | "title" | "ref" | "location" | "priceLabel">;

export function propertyPath(property: Pick<ShareProperty, "category" | "slug">) {
  return `/${property.category === "terrain" ? "terrains" : "immobilier"}/${encodeURIComponent(property.slug)}`;
}

export function propertyShareDetails(property: ShareProperty, origin: string) {
  const url = new URL(propertyPath(property), origin).toString();
  const message = `${property.title}\n${property.priceLabel} · ${property.location}\nRéf. ${property.ref}\nInformations à confirmer.\n${url}`;
  return {
    url,
    message,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}
