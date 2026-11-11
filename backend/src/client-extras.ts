import { getAuthConfig, type VerifiedUser } from "./user-auth";

type ServiceConfig = { baseUrl: string; serviceRoleKey: string };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;
const alertCategories = new Set(["terrain", "immobilier"]);
const alertKeys = new Set(["category", "region", "prixMax", "surfaceMin"]);
const maxFavorites = 50;
const maxAlerts = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function jsonError(message: string, status: number) {
  return json({ error: message }, status);
}

function headers(config: ServiceConfig) {
  return { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" };
}

async function call(config: ServiceConfig, path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: { ...headers(config), ...(init.prefer ? { Prefer: init.prefer } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër client extras unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

async function rows(config: ServiceConfig, path: string): Promise<unknown[] | null> {
  const response = await call(config, `/rest/v1/${path}`);
  if (!response?.ok) return null;
  const payload: unknown = await response.json();
  return Array.isArray(payload) ? payload : null;
}

const unavailable = () => jsonError("Ce service est momentanément indisponible.", 503);

async function listFavorites(config: ServiceConfig, user: VerifiedUser) {
  const result = await rows(config, `client_favorites?select=property_slug,created_at&user_id=eq.${user.id}&order=created_at.desc&limit=${maxFavorites}`);
  if (!result) return unavailable();
  return json({ favorites: result.filter(isRecord).map((row) => row.property_slug) });
}

async function addFavorite(config: ServiceConfig, user: VerifiedUser, input: unknown) {
  if (!isRecord(input) || typeof input.slug !== "string" || !slugPattern.test(input.slug) || Object.keys(input).length !== 1) {
    return jsonError("Bien invalide.", 400);
  }
  const published = await rows(config, `property_listings?select=slug&slug=eq.${input.slug}&publication_status=eq.published&limit=1`);
  if (!published) return unavailable();
  if (published.length !== 1) return jsonError("Ce bien n’est pas disponible.", 404);
  const count = await rows(config, `client_favorites?select=property_slug&user_id=eq.${user.id}&limit=${maxFavorites + 1}`);
  if (!count) return unavailable();
  if (count.length >= maxFavorites) return jsonError("Vous avez atteint la limite de favoris.", 400);
  const response = await call(config, "/rest/v1/client_favorites?on_conflict=user_id,property_slug", {
    method: "POST", body: { user_id: user.id, property_slug: input.slug }, prefer: "resolution=ignore-duplicates,return=minimal",
  });
  if (!response?.ok) return unavailable();
  return json({ saved: true }, 201);
}

async function removeFavorite(config: ServiceConfig, user: VerifiedUser, slug: string) {
  if (!slugPattern.test(slug)) return jsonError("Bien invalide.", 400);
  const response = await call(config, `/rest/v1/client_favorites?user_id=eq.${user.id}&property_slug=eq.${slug}`, { method: "DELETE", prefer: "return=minimal" });
  return response?.ok ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }) : unavailable();
}

function validateCriteria(value: unknown): Record<string, string | number> | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !alertKeys.has(key))) return null;
  const criteria: Record<string, string | number> = {};
  if (value.category !== undefined) {
    if (typeof value.category !== "string" || !alertCategories.has(value.category)) return null;
    criteria.category = value.category;
  }
  if (value.region !== undefined) {
    if (typeof value.region !== "string" || value.region.trim().length < 2 || value.region.trim().length > 80) return null;
    criteria.region = value.region.trim();
  }
  if (value.prixMax !== undefined) {
    if (!Number.isSafeInteger(value.prixMax) || (value.prixMax as number) <= 0 || (value.prixMax as number) > 10_000_000_000) return null;
    criteria.prixMax = value.prixMax as number;
  }
  if (value.surfaceMin !== undefined) {
    if (typeof value.surfaceMin !== "number" || !Number.isFinite(value.surfaceMin) || value.surfaceMin <= 0 || value.surfaceMin > 1_000_000) return null;
    criteria.surfaceMin = value.surfaceMin;
  }
  if (Object.keys(criteria).length === 0) return null;
  return criteria;
}

async function listAlerts(config: ServiceConfig, user: VerifiedUser) {
  const result = await rows(config, `client_alerts?select=id,criteria,created_at&user_id=eq.${user.id}&order=created_at.desc&limit=${maxAlerts}`);
  if (!result) return unavailable();
  return json({
    alerts: result.filter(isRecord).map((row) => ({ id: row.id, criteria: row.criteria, createdAt: row.created_at })),
    // Les alertes sont enregistrées ; leur envoi reste désactivé tant qu'aucun fournisseur d'e-mail n'est configuré.
    sending: false,
  });
}

async function addAlert(config: ServiceConfig, user: VerifiedUser, input: unknown) {
  if (!isRecord(input) || Object.keys(input).length !== 1) return jsonError("Critères invalides.", 400);
  const criteria = validateCriteria(input.criteria);
  if (!criteria) return jsonError("Indiquez au moins un critère valide (catégorie, région, prix maximum ou surface minimum).", 400);
  const count = await rows(config, `client_alerts?select=id&user_id=eq.${user.id}&limit=${maxAlerts + 1}`);
  if (!count) return unavailable();
  if (count.length >= maxAlerts) return jsonError("Vous avez atteint la limite d’alertes.", 400);
  const response = await call(config, "/rest/v1/client_alerts", { method: "POST", body: { user_id: user.id, criteria }, prefer: "return=minimal" });
  return response?.ok ? json({ saved: true }, 201) : unavailable();
}

async function removeAlert(config: ServiceConfig, user: VerifiedUser, id: string) {
  if (!uuidPattern.test(id)) return jsonError("Alerte invalide.", 400);
  const response = await call(config, `/rest/v1/client_alerts?id=eq.${id}&user_id=eq.${user.id}`, { method: "DELETE", prefer: "return=minimal" });
  return response?.ok ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }) : unavailable();
}

async function listNotifications(config: ServiceConfig, user: VerifiedUser) {
  const result = await rows(config, `client_notifications?select=id,title,body,created_at,read_at&user_id=eq.${user.id}&order=created_at.desc&limit=30`);
  if (!result) return unavailable();
  return json({
    notifications: result.filter(isRecord).map((row) => ({ id: row.id, title: row.title, body: row.body, createdAt: row.created_at, read: row.read_at !== null })),
  });
}

async function markNotificationsRead(config: ServiceConfig, user: VerifiedUser) {
  const response = await call(config, `/rest/v1/client_notifications?user_id=eq.${user.id}&read_at=is.null`, {
    method: "PATCH", body: { read_at: new Date().toISOString() }, prefer: "return=minimal",
  });
  return response?.ok ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }) : unavailable();
}

// Effacement : d'abord les données de l'application (idempotent), puis le compte d'authentification.
// Si la seconde étape échoue, l'utilisateur peut recommencer sans perte.
async function deleteAccount(config: ServiceConfig, user: VerifiedUser) {
  const erased = await call(config, "/rest/v1/rpc/erase_client_account", { method: "POST", body: { p_user: user.id } });
  if (!erased?.ok) return unavailable();
  const removed = await call(config, `/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
  if (!removed?.ok) {
    console.error("Sama Kër account deletion incomplete", removed?.status ?? "network");
    return jsonError("Vos données ont été effacées, mais le compte n’a pas pu être supprimé. Réessayez ou contactez l’équipe.", 503);
  }
  return json({ deleted: true });
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "DELETE") return null;
  const text = await request.text();
  if (text.trim() === "") return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

// Route les sous-chemins de /api/client au-delà des demandes. Retourne null si la route est inconnue.
export async function handleClientExtras(request: Request, user: VerifiedUser, path: string[]): Promise<Response | null> {
  const auth = getAuthConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!auth || !serviceRoleKey) return unavailable();
  const config: ServiceConfig = { baseUrl: auth.baseUrl, serviceRoleKey };
  const body = await readBody(request);
  if (body === undefined) return jsonError("Le contenu de la demande n’est pas un JSON valide.", 400);
  const [section, id] = path;

  if (section === "favorites" && path.length === 1) {
    if (request.method === "GET") return listFavorites(config, user);
    if (request.method === "POST") return addFavorite(config, user, body);
  }
  if (section === "favorites" && path.length === 2 && request.method === "DELETE") return removeFavorite(config, user, id);
  if (section === "alerts" && path.length === 1) {
    if (request.method === "GET") return listAlerts(config, user);
    if (request.method === "POST") return addAlert(config, user, body);
  }
  if (section === "alerts" && path.length === 2 && request.method === "DELETE") return removeAlert(config, user, id);
  if (section === "notifications" && path.length === 1 && request.method === "GET") return listNotifications(config, user);
  if (section === "notifications" && path.length === 2 && path[1] === "read" && request.method === "POST") return markNotificationsRead(config, user);
  if (section === "account" && path.length === 1 && request.method === "DELETE") return deleteAccount(config, user);
  return null;
}
