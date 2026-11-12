const MAX_ADMIN_BODY_BYTES = 16_384;
const propertyStatuses = new Set(["Disponible", "À louer", "Réservé", "Vendu"]);
const publicationStatuses = new Set(["draft", "review", "published", "archived"]);
export const leadStages = new Set(["Nouveau", "À qualifier", "Visite planifiée", "Dossier ouvert", "Fermé"]);
const appointmentStatuses = new Set(["À confirmer", "Confirmé", "Annulé"]);
const categories = new Set(["terrain", "immobilier"]);

export type AdminUser = { id: string; email: string };
type ListingPhoto = { src: string; alt: string; credit: string; sourceUrl: string; previewSrc?: string };
type ListingInput = {
  ref: string;
  title: string;
  category: "terrain" | "immobilier";
  region: string;
  location: string;
  price: number;
  pricePeriod: "total" | "monthly";
  area: number;
  kind: string;
  status: string;
  description: string;
  features: string[];
  publicationStatus: string;
  latitude: number | null;
  longitude: number | null;
  photos: ListingPhoto[];
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export type AdminConfig = NonNullable<ReturnType<typeof getConfig>>;

export function getConfig() {
  const rawUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowedEmails = process.env.ADMIN_EMAILS?.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!rawUrl || !anonKey || !serviceRoleKey || allowedEmails.length === 0) return null;

  try {
    const url = new URL(rawUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!local && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return { baseUrl: url.origin, anonKey, serviceRoleKey, allowedEmails };
  } catch {
    return null;
  }
}

// Vérifie l'identité (jeton valide, adresse confirmée). L'autorisation dépend ensuite du rôle de l'équipe.
export async function authenticate(request: Request, config: NonNullable<ReturnType<typeof getConfig>>): Promise<AdminUser | Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer ([^\s]+)$/.exec(authorization)?.[1];
  if (!token) return jsonError("Connexion requise.", 401);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: "Bearer " + token },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër admin auth unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("Le service d’authentification est indisponible.", 503);
  }
  if (response.status === 401 || response.status === 403) return jsonError("Session invalide ou expirée.", 401);
  if (!response.ok) {
    console.error("Sama Kër admin auth returned", response.status);
    return jsonError("Le service d’authentification est indisponible.", 503);
  }

  const user: unknown = await response.json();
  if (!isRecord(user) || typeof user.id !== "string" || typeof user.email !== "string") {
    return jsonError("La session n’a pas pu être vérifiée.", 401);
  }
  if (typeof user.email_confirmed_at !== "string" || !user.email_confirmed_at) {
    return jsonError("Confirmez votre adresse e-mail pour accéder à l’administration.", 403);
  }
  const email = user.email.trim().toLowerCase();
  return { id: user.id, email };
}

export async function readJson(request: Request): Promise<unknown | Response> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return jsonError("Format de demande invalide.", 415);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > MAX_ADMIN_BODY_BYTES) return jsonError("La demande dépasse la taille autorisée.", 413);

  const reader = request.body?.getReader();
  if (!reader) return jsonError("Le contenu de la demande est vide.", 400);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ADMIN_BODY_BYTES) {
      await reader.cancel();
      return jsonError("La demande dépasse la taille autorisée.", 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Le contenu envoyé n’est pas un JSON valide.", 400);
    throw error;
  }
}

export async function databaseRequest(
  config: NonNullable<ReturnType<typeof getConfig>>,
  path: string,
  method = "GET",
  body?: unknown,
  prefer?: string,
) {
  const headers: Record<string, string> = {
    apikey: config.serviceRoleKey,
    Authorization: "Bearer " + config.serviceRoleKey,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër admin database unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("La base de données est momentanément indisponible.", 503);
  }
  if (!response.ok) {
    console.error("Sama Kër admin database returned", response.status);
    return jsonError(
      response.status === 409 ? "Cette référence existe déjà." : "L’opération n’a pas pu être enregistrée.",
      response.status === 409 ? 409 : response.status === 404 ? 404 : response.status >= 400 && response.status < 500 ? 400 : 503,
    );
  }
  return response;
}

export async function patchOne(
  config: NonNullable<ReturnType<typeof getConfig>>,
  tableQuery: string,
  values: Record<string, unknown>,
) {
  const response = await databaseRequest(
    config,
    tableQuery,
    "PATCH",
    values,
    "return=representation",
  );
  if (!(response instanceof Response) || !response.ok) return response;
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) return jsonError("Enregistrement introuvable.", 404);
  return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}

export function validString(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

// Limites géographiques du Sénégal : la même plage est imposée par la base.
const latitudeRange = [12.0, 16.8] as const;
const longitudeRange = [-17.8, -11.3] as const;

function parseCoordinate(value: unknown, range: readonly [number, number]): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) return undefined;
  return Math.round(value * 100) / 100;
}

function validateListing(value: unknown): ListingInput | null {
  if (!isRecord(value)) return null;
  const {
    ref, title, category, region, location, price, pricePeriod, area, kind, status,
    description, features, publicationStatus, photos,
  } = value;
  const latitude = parseCoordinate(value.latitude, latitudeRange);
  const longitude = parseCoordinate(value.longitude, longitudeRange);
  if (latitude === undefined || longitude === undefined || (latitude === null) !== (longitude === null)) return null;
  if (!validString(ref, 2, 40) || !validString(title, 5, 140) ||
    typeof category !== "string" || !categories.has(category) ||
    !validString(region, 2, 80) || !validString(location, 2, 100) ||
    typeof price !== "number" || !Number.isSafeInteger(price) || price <= 0 ||
    (pricePeriod !== "total" && pricePeriod !== "monthly") ||
    typeof area !== "number" || !Number.isFinite(area) || area <= 0 || area > 99_999_999 ||
    !validString(kind, 2, 80) || typeof status !== "string" || !propertyStatuses.has(status) ||
    !validString(description, 20, 2000) || !Array.isArray(features) || features.length > 12 ||
    !features.every((feature) => validString(feature, 1, 120)) ||
    typeof publicationStatus !== "string" || !publicationStatuses.has(publicationStatus) ||
    !Array.isArray(photos) || photos.length > 12) return null;

  const parsedPhotos: ListingPhoto[] = [];
  for (const photo of photos) {
    if (!isRecord(photo) || !validString(photo.src, 1, 2048) ||
      !validString(photo.alt, 10, 240) || !validString(photo.credit, 2, 160) ||
      (photo.sourceUrl !== "" && !validString(photo.sourceUrl, 1, 2048))) return null;
    try {
      const src = new URL(photo.src);
      const sourceUrl = photo.sourceUrl ? new URL(String(photo.sourceUrl)) : null;
      if (src.protocol !== "https:" || (sourceUrl && sourceUrl.protocol !== "https:")) return null;
      parsedPhotos.push({
        src: src.toString(),
        alt: photo.alt.trim(),
        credit: photo.credit.trim(),
        sourceUrl: sourceUrl?.toString() ?? "",
      });
    } catch {
      return null;
    }
  }

  return {
    ref: ref.trim(),
    title: title.trim(),
    category: category as ListingInput["category"],
    region: region.trim(),
    location: location.trim(),
    price,
    pricePeriod,
    area,
    kind: kind.trim(),
    status,
    description: description.trim(),
    features: features.map((feature) => feature.trim()),
    publicationStatus,
    photos: parsedPhotos,
    latitude,
    longitude,
  };
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function listingPayload(listing: ListingInput, slug?: string) {
  return {
    ...(slug ? { slug } : {}),
    reference: listing.ref,
    category: listing.category,
    title: listing.title,
    region: listing.region,
    location_label: listing.location,
    price_amount: listing.price,
    price_period: listing.pricePeriod,
    area_m2: listing.area,
    property_type: listing.kind,
    availability_status: listing.status,
    description: listing.description,
    features: listing.features,
    publication_status: listing.publicationStatus,
    public_latitude: listing.latitude,
    public_longitude: listing.longitude,
  };
}

async function saveListing(
  config: NonNullable<ReturnType<typeof getConfig>>,
  propertyId: string | null,
  listing: ListingInput,
  user: AdminUser,
  slug?: string,
) {
  const saved = await databaseRequest(
    config,
    "rpc/save_reviewable_listing",
    "POST",
    {
      p_property_id: propertyId,
      p_listing: listingPayload(listing, slug),
      p_photos: listing.photos,
      p_actor: user.id,
    },
    "return=representation",
  );
  if (!(saved instanceof Response) || !saved.ok) return saved;
  const rows: unknown = await saved.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!isRecord(row) || typeof row.id !== "string") return jsonError("L’annonce n’a pas pu être enregistrée.", 503);
  return Response.json({ id: row.id }, { headers: { "Cache-Control": "no-store" } });
}

async function listListings(config: NonNullable<ReturnType<typeof getConfig>>) {
  const response = await databaseRequest(
    config,
    "property_listings?select=id,slug,reference,category,title,region,location_label,price_amount,price_period,area_m2,property_type,availability_status,description,features,publication_status,public_latitude,public_longitude,listing_review_state(revision),property_listing_media(image_url,alt_text,credit,source_url,position)&property_listing_media.order=position.asc&order=updated_at.desc&limit=500",
  );
  if (!(response instanceof Response) || !response.ok) return response;
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return jsonError("Les annonces reçues sont invalides.", 503);
  const mapped = rows.map((row): (Record<string, unknown> & { photos: ListingPhoto[] }) | null => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.slug !== "string" ||
      typeof row.reference !== "string" || typeof row.title !== "string" ||
      typeof row.region !== "string" || typeof row.location_label !== "string" ||
      typeof row.category !== "string" || !categories.has(row.category) ||
      typeof row.price_period !== "string" || !["total", "monthly"].includes(row.price_period) ||
      typeof row.property_type !== "string" || typeof row.availability_status !== "string" ||
      typeof row.description !== "string" || !Array.isArray(row.features) ||
      typeof row.publication_status !== "string" || !publicationStatuses.has(row.publication_status)) return null;
    const price = Number(row.price_amount);
    const area = Number(row.area_m2);
    if (!Number.isSafeInteger(price) || price <= 0 || !Number.isFinite(area) || area <= 0 ||
      !row.features.every((feature) => typeof feature === "string")) return null;
    const rawPhotos = row.property_listing_media;
    if (!Array.isArray(rawPhotos)) return null;
    const review = row.listing_review_state;
    if (review !== null && (!isRecord(review) || typeof review.revision !== "number" ||
      !Number.isSafeInteger(review.revision) || review.revision < 1)) return null;
    const photos: ListingPhoto[] = [];
    for (const photo of rawPhotos) {
      if (!isRecord(photo) || typeof photo.image_url !== "string" || typeof photo.alt_text !== "string" ||
        typeof photo.credit !== "string" || (photo.source_url !== null && typeof photo.source_url !== "string")) return null;
      photos.push({
        src: photo.image_url,
        alt: photo.alt_text,
        credit: photo.credit,
        sourceUrl: photo.source_url ?? "",
      });
    }
    return {
      id: row.id,
      slug: row.slug,
      ref: row.reference,
      category: row.category,
      title: row.title,
      region: row.region,
      locationLabel: row.location_label,
      location: `${row.location_label}, ${row.region}`,
      price,
      priceLabel: `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(price)} FCFA${row.price_period === "monthly" ? " / mois" : ""}`,
      pricePeriod: row.price_period,
      area,
      kind: row.property_type,
      status: row.availability_status,
      verified: false,
      featured: false,
      isDemo: false,
      art: row.category === "terrain" ? "field" : "house",
      description: row.description,
      features: row.features,
      photos,
      publicationStatus: row.publication_status,
      reviewRevision: isRecord(review) ? review.revision : null,
      ...(row.public_latitude !== null && row.public_latitude !== undefined && row.public_longitude !== null && row.public_longitude !== undefined
        ? { coordinates: { lat: Number(row.public_latitude), lng: Number(row.public_longitude) } }
        : {}),
    };
  });
  if (mapped.some((listing) => listing === null)) return jsonError("Une annonce reçue contient des données invalides.", 503);
  return Response.json(mapped, { headers: { "Cache-Control": "no-store" } });
}

export async function handleProperties(request: Request, config: NonNullable<ReturnType<typeof getConfig>>, path: string[], user: AdminUser) {
  if (path.length === 0 && request.method === "GET") return listListings(config);

  if (path.length === 0 && request.method === "POST") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    const listing = validateListing(input);
    if (!listing) return jsonError("Vérifiez les champs de l’annonce et des médias.", 400);
    if (listing.publicationStatus === "published") return jsonError("La publication exige l’approbation d’un responsable distinct.", 403);
    const slug = `${slugify(listing.title)}-${slugify(listing.ref)}`.replace(/^-|-$/g, "").slice(0, 120);
    const saved = await saveListing(config, null, listing, user, slug);
    if (!(saved instanceof Response) || !saved.ok) return saved;
    return Response.json(await saved.json(), { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  if (path.length === 1 && /^[0-9a-f-]{36}$/i.test(path[0]) && request.method === "PATCH") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (!isRecord(input)) return jsonError("Les champs de l’annonce sont invalides.", 400);

    if (typeof input.availabilityStatus === "string" && propertyStatuses.has(input.availabilityStatus) &&
      Object.keys(input).length === 1) {
      return databaseRequest(config, "rpc/change_reviewable_availability", "POST", {
        p_property_id: path[0], p_status: input.availabilityStatus, p_actor: user.id,
      });
    }

    const listing = validateListing(input);
    if (!listing) return jsonError("Vérifiez les champs de l’annonce et des médias.", 400);
    if (listing.publicationStatus === "published") return jsonError("La publication exige l’approbation d’un responsable distinct.", 403);
    return saveListing(config, path[0], listing, user);
  }
  if (path.length === 2 && /^[0-9a-f-]{36}$/i.test(path[0]) && path[1] === "approve" && request.method === "POST") {
    // L'habilitation à valider (rôle « responsable » ou LISTING_REVIEWER_EMAILS) est vérifiée par le routeur.
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (!isRecord(input) || !Number.isSafeInteger(input.revision) || Number(input.revision) < 1 ||
      input.fieldsConfirmed !== true || input.mediaConfirmed !== true || input.publicContentConfirmed !== true ||
      Object.keys(input).length !== 4) return jsonError("Confirmez tous les contrôles avant publication.", 400);
    const result = await databaseRequest(config, "rpc/approve_reviewable_listing", "POST", {
      p_property_id: path[0], p_revision: input.revision, p_actor: user.id,
    });
    if (result instanceof Response && !result.ok && result.status === 400) {
      return jsonError("Validation refusée : l’annonce a changé, n’est pas à vérifier, n’a pas de photo ou vous l’avez modifiée. Rechargez la page.", 409);
    }
    return result;
  }
  return jsonError("Route introuvable.", 404);
}

export async function handleAppointments(request: Request, config: NonNullable<ReturnType<typeof getConfig>>, path: string[], user: AdminUser) {
  if (path.length === 0 && request.method === "GET") {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!from || !to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || Date.parse(to) <= Date.parse(from)) {
      return jsonError("La période de l’agenda est invalide.", 400);
    }
    const query = new URLSearchParams({
      select: "id,contact_name,contact_email,purpose,starts_at,location,status,lead_id",
      order: "starts_at.asc",
      limit: "500",
      and: `(starts_at.gte.${new Date(from).toISOString()},starts_at.lt.${new Date(to).toISOString()})`,
    });
    return databaseRequest(config, `admin_appointments?${query.toString()}`);
  }
  if (path.length === 0 && request.method === "POST") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (isRecord(input) && input.leadId !== undefined &&
      (typeof input.leadId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.leadId))) {
      return jsonError("Le prospect associé est invalide.", 400);
    }
    if (!isRecord(input) || !validString(input.contactName, 2, 120) ||
      !validString(input.contactEmail, 3, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail) ||
      !validString(input.purpose, 3, 240) || typeof input.startsAt !== "string" ||
      !Number.isFinite(Date.parse(input.startsAt)) ||
      (input.location !== undefined && !validString(input.location, 0, 240))) {
      return jsonError("Vérifiez les informations du rendez-vous.", 400);
    }
    return databaseRequest(config, "admin_appointments", "POST", {
      contact_name: input.contactName.trim(),
      contact_email: input.contactEmail.trim().toLowerCase(),
      purpose: input.purpose.trim(),
      starts_at: new Date(input.startsAt).toISOString(),
      location: typeof input.location === "string" ? input.location.trim() : "",
      lead_id: typeof input.leadId === "string" ? input.leadId : null,
      created_by: user.id,
    }, "return=representation");
  }
  if (path.length === 1 && /^[0-9a-f-]{36}$/i.test(path[0]) && request.method === "PATCH") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (!isRecord(input) || typeof input.status !== "string" || !appointmentStatuses.has(input.status) ||
      Object.keys(input).length !== 1) return jsonError("Statut de rendez-vous invalide.", 400);
    const updated = await patchOne(config, `admin_appointments?id=eq.${path[0]}&select=id`, {
      status: input.status,
      updated_at: new Date().toISOString(),
    });
    if (updated.status === 400) return jsonError("Modification refusée. Pour les visites du calendrier public, utilisez le suivi des demandes de visite.", 409);
    return updated;
  }
  return jsonError("Route introuvable.", 404);
}

export async function loadDashboard(config: AdminConfig) {
  const [listings, leads, appointments] = await Promise.all([
    databaseRequest(config, "property_listings?select=id,category,publication_status&limit=1000"),
    databaseRequest(config, "crm_leads?select=id,pipeline_stage&limit=1000"),
    databaseRequest(config, "admin_appointments?select=id,starts_at,status&limit=1000"),
  ]);
  const failed = [listings, leads, appointments].find((result) => result instanceof Response && !result.ok);
  if (failed) return failed;
  const [listingRows, leadRows, appointmentRows] = await Promise.all([
    (listings as Response).json(),
    (leads as Response).json(),
    (appointments as Response).json(),
  ]) as [unknown, unknown, unknown];
  if (!Array.isArray(listingRows) || !Array.isArray(leadRows) || !Array.isArray(appointmentRows)) {
    return jsonError("Les indicateurs n’ont pas pu être chargés.", 503);
  }
  const upcoming = appointmentRows.filter((item) => isRecord(item) && typeof item.starts_at === "string" &&
    Date.parse(item.starts_at) >= Date.now() && item.status !== "Annulé");
  return Response.json({
    listings: listingRows.length,
    land: listingRows.filter((item) => isRecord(item) && item.category === "terrain").length,
    realEstate: listingRows.filter((item) => isRecord(item) && item.category === "immobilier").length,
    published: listingRows.filter((item) => isRecord(item) && item.publication_status === "published").length,
    leads: leadRows.length,
    leadsToQualify: leadRows.filter((item) => isRecord(item) && item.pipeline_stage === "À qualifier").length,
    appointments: upcoming.length,
  }, { headers: { "Cache-Control": "no-store" } });
}
