import { connection } from "next/server";
import { properties as exampleProperties, type Property, type PropertyCoordinates, type PropertyPhoto } from "./properties";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Supabase returned an invalid public listing field: ${key}.`);
  }
  return value.trim();
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Supabase returned an invalid public listing field: ${key}.`);
  }
  return number;
}

function mapCoordinates(row: Record<string, unknown>): PropertyCoordinates | null {
  const latitude = row.public_latitude;
  const longitude = row.public_longitude;
  if ((latitude === null || latitude === undefined) && (longitude === null || longitude === undefined)) return null;
  const lat = typeof latitude === "number" ? latitude : typeof latitude === "string" ? Number(latitude) : NaN;
  const lng = typeof longitude === "number" ? longitude : typeof longitude === "string" ? Number(longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 12 || lat > 16.8 || lng < -17.8 || lng > -11.3) {
    throw new Error("Supabase returned an invalid public listing location.");
  }
  return { lat, lng };
}

function mapMedia(value: unknown): PropertyPhoto[] {
  if (!Array.isArray(value) || value.length > 12) {
    throw new Error("Supabase returned an invalid public listing media collection.");
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase returned an invalid public listing media item.");
    }

    const src = requiredString(item, "image_url");
    const sourceUrl = item.source_url === null ? "" : requiredString(item, "source_url");
    if (new URL(src).protocol !== "https:" || (sourceUrl && new URL(sourceUrl).protocol !== "https:")) {
      throw new Error("Published listing media URLs must use HTTPS.");
    }

    return {
      src,
      alt: requiredString(item, "alt_text"),
      credit: requiredString(item, "credit"),
      sourceUrl,
    };
  });
}

export function mapPublicListings(value: unknown): Property[] {
  if (!Array.isArray(value)) {
    throw new Error("Supabase returned an invalid public listings response.");
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error("Supabase returned an invalid public listing.");
    }

    const slug = requiredString(item, "slug");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("Supabase returned a public listing with an invalid slug.");
    }

    const category = requiredString(item, "category");
    if (category !== "terrain" && category !== "immobilier") {
      throw new Error("Supabase returned a public listing with an invalid category.");
    }

    const pricePeriod = requiredString(item, "price_period");
    if (pricePeriod !== "total" && pricePeriod !== "monthly") {
      throw new Error("Supabase returned a public listing with an invalid price period.");
    }

    const media = mapMedia(item.property_listing_media);
    const price = requiredNumber(item, "price_amount");
    if (!Number.isSafeInteger(price)) {
      throw new Error("Supabase returned an invalid public listing field: price_amount.");
    }
    const features = item.features;
    if (!Array.isArray(features) || features.length > 12) {
      throw new Error("Supabase returned an invalid public listing field: features.");
    }
    const featureList: string[] = [];
    for (const feature of features) {
      if (typeof feature !== "string" || !feature.trim()) {
        throw new Error("Supabase returned an invalid public listing field: features.");
      }
      featureList.push(feature.trim());
    }

    const reference = requiredString(item, "reference");
    const title = requiredString(item, "title");
    const region = requiredString(item, "region");
    const locationLabel = `${requiredString(item, "location_label")}, ${region}`;
    const propertyType = requiredString(item, "property_type");
    const availabilityStatus = requiredString(item, "availability_status");
    if (!["Disponible", "À louer", "Réservé", "Vendu"].includes(availabilityStatus)) {
      throw new Error("Supabase returned a public listing with an invalid availability status.");
    }
    const description = requiredString(item, "description");
    const area = requiredNumber(item, "area_m2");
    const coordinates = mapCoordinates(item);

    return {
      slug,
      ref: reference,
      category,
      title,
      region,
      location: locationLabel,
      price,
      priceLabel: `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(price)} FCFA${pricePeriod === "monthly" ? " / mois" : ""}`,
      area,
      kind: propertyType,
      status: availabilityStatus,
      verified: false,
      featured: false,
      isDemo: false,
      art: category === "terrain" ? "field" : "house",
      description,
      features: featureList,
      photos: media,
      ...(coordinates ? { coordinates } : {}),
    };
  });
}

export function publicPhotoProxyUrl(src: string, supabaseOrigin: string, apiUrlValue: string | undefined) {
  const image = new URL(src);
  const supabase = new URL(supabaseOrigin);
  const privatePrefix = "/storage/v1/object/authenticated/listing-images/";
  if (image.origin !== supabase.origin || !image.pathname.startsWith(privatePrefix)) return src;
  if (image.search || image.hash || image.username || image.password) {
    throw new Error("A private listing photo URL must not contain credentials or query parameters.");
  }

  let objectPath = "";
  try {
    objectPath = decodeURIComponent(image.pathname.slice(privatePrefix.length));
  } catch (error) {
    throw new Error("Supabase returned an invalid private listing photo path.", { cause: error });
  }
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(objectPath)) {
    throw new Error("Supabase returned an invalid private listing photo path.");
  }
  if (!apiUrlValue) throw new Error("NEXT_PUBLIC_API_URL is required to serve approved private listing photos.");

  const apiUrl = new URL(apiUrlValue);
  const local = apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";
  if ((!local && apiUrl.protocol !== "https:") || apiUrl.username || apiUrl.password ||
    apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash) {
    throw new Error("NEXT_PUBLIC_API_URL must be an HTTPS origin.");
  }
  return new URL(`/api/public/listing-images/${objectPath}`, apiUrl.origin).toString();
}

export async function getPropertyCatalog(): Promise<{ properties: Property[]; isDemo: boolean }> {
  await connection();
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl && !anonKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required to serve public listings in production.");
    }
    return { properties: exampleProperties, isDemo: true };
  }
  if (!supabaseUrl || !anonKey) {
    throw new Error("Configure both SUPABASE_URL and SUPABASE_ANON_KEY to load published listings.");
  }

  const baseUrl = new URL(supabaseUrl);
  const isLocal = baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1";
  if (
    (!isLocal && baseUrl.protocol !== "https:") ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error("SUPABASE_URL must be an HTTPS origin.");
  }

  const url = new URL("/rest/v1/property_listings", baseUrl);
  url.searchParams.set(
    "select",
    "slug,reference,category,title,region,location_label,price_amount,price_period,area_m2,property_type,availability_status,description,features,public_latitude,public_longitude,property_listing_media(image_url,alt_text,credit,source_url,position)",
  );
  url.searchParams.set("property_listing_media.order", "position.asc");
  url.searchParams.set("publication_status", "eq.published");
  url.searchParams.set("order", "published_at.desc");
  url.searchParams.set("limit", "500");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error("Could not connect to Supabase to load published listings.", { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Could not load published listings from Supabase (HTTP ${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Supabase returned an invalid public listings response.", { cause: error });
  }
  const properties = mapPublicListings(payload).map((property) => ({
    ...property,
    photos: property.photos?.map((photo) => ({
      ...photo,
      src: publicPhotoProxyUrl(photo.src, baseUrl.origin, process.env.NEXT_PUBLIC_API_URL),
    })),
  }));
  return { properties, isDemo: false };
}

export async function getPublicProperties(): Promise<Property[]> {
  return (await getPropertyCatalog()).properties;
}
