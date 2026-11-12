import { databaseRequest, isRecord, jsonError, readJson, type AdminConfig } from "./admin";
import { parseGeoProfile } from "./geospatial-profile-schema";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleGeospatialProfile(request: Request, config: AdminConfig, path: string[]) {
  if (process.env.GEOSPATIAL_PROFILE_ENABLED !== "true") return jsonError("La fiche géospatiale n’est pas encore activée.", 503);
  if (path.length !== 1 || !uuid.test(path[0])) return jsonError("Terrain invalide.", 400);
  if (request.method !== "GET" && request.method !== "PUT") return jsonError("Méthode non autorisée.", 405);
  const id = path[0];
  const listing = await databaseRequest(config, `property_listings?select=id,category&id=eq.${id}&limit=1`);
  if (!listing.ok) return listing;
  const rows: unknown = await listing.json();
  if (!Array.isArray(rows) || rows.length !== 1 || !isRecord(rows[0]) || rows[0].category !== "terrain") return jsonError("Terrain introuvable.", 404);
  const table = `listing_geospatial_profiles?property_id=eq.${id}`;
  if (request.method === "GET") {
    const response = await databaseRequest(config, `${table}&select=data,revision,updated_at&limit=1`);
    if (!response.ok) return response;
    const profiles: unknown = await response.json();
    if (!Array.isArray(profiles) || profiles.length > 1) return jsonError("La fiche reçue est invalide.", 503);
    if (!profiles.length) return Response.json({ profile: null, revision: 0, updatedAt: null }, { headers: { "Cache-Control": "no-store" } });
    const row = profiles[0];
    if (!isRecord(row) || !parseGeoProfile(row.data) || !Number.isSafeInteger(row.revision) || typeof row.updated_at !== "string") return jsonError("La fiche reçue est invalide.", 503);
    return Response.json({ profile: row.data, revision: row.revision, updatedAt: row.updated_at }, { headers: { "Cache-Control": "no-store" } });
  }
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isRecord(body) || !Number.isSafeInteger(body.revision) || typeof body.revision !== "number" || body.revision < 0 || body.revision >= 2147483647) return jsonError("Révision de fiche invalide.", 400);
  const profile = parseGeoProfile(body.profile);
  if (!profile) return jsonError("Fiche invalide : vérifiez chaque valeur, sa source, sa date et sa fiabilité, ainsi que les coordonnées et le polygone.", 400);
  const revision = body.revision;
  const saved = revision === 0
    ? await databaseRequest(config, "listing_geospatial_profiles", "POST", { property_id: id, data: profile, revision: 1 }, "return=representation")
    : await databaseRequest(config, `${table}&revision=eq.${revision}`, "PATCH", { data: profile, revision: revision + 1, updated_at: new Date().toISOString() }, "return=representation");
  if (!saved.ok) {
    if (revision === 0 && saved.status === 409) return jsonError("La fiche a été créée entre-temps. Rechargez-la avant de réessayer.", 409);
    return saved;
  }
  const updated: unknown = await saved.json();
  if (!Array.isArray(updated) || updated.length === 0) return jsonError("La fiche a été modifiée entre-temps. Rechargez-la avant de réessayer.", 409);
  if (updated.length !== 1 || !isRecord(updated[0]) || !Number.isSafeInteger(updated[0].revision) || typeof updated[0].updated_at !== "string") return jsonError("La réponse de la base est invalide.", 503);
  return Response.json({ revision: updated[0].revision, updatedAt: updated[0].updated_at }, { headers: { "Cache-Control": "no-store" } });
}
