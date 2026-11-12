import {
  authenticate, getConfig, handleAppointments, handleProperties, jsonError, loadDashboard, isRecord, type AdminConfig,
} from "./admin";
import { handleLeads, handleReminders } from "./crm";
import { can, resolveStaff, roleLabels, writeAudit, type AuditDetails, type Permission, type StaffIdentity } from "./staff";
import { handleAudit, handleStaff } from "./team";
import { handleFiles } from "./files";
import { addAdminImagePreviews, handleListingImageDelete, handleListingImageUpload } from "./listing-images";
import { handleVisits } from "./visits";
import { handleGeospatialProfile } from "./geospatial-profile";

const uuidPattern = /^[0-9a-f-]{36}$/i;
// Seuls ces champs techniques du corps de la requête peuvent figurer dans le journal : jamais un message, une note ou un nom.
const auditedFields = ["pipelineStage", "availabilityStatus", "status", "assignedTo", "role", "active", "publicationStatus", "revision", "kind", "dueAt"] as const;

function requiredPermission(resource: string, method: string, path: string[]): Permission | null | undefined {
  const read = method === "GET";
  switch (resource) {
    case "session": return null;
    case "dashboard": return "dashboard:read";
    case "properties":
      if (read) return "properties:read";
      return path[1] === "approve" ? "properties:review" : "properties:write";
    case "leads": return read ? "leads:read" : "leads:write";
    case "reminders": return read ? "leads:read" : "leads:write";
    case "appointments": return read ? "appointments:read" : "appointments:write";
    case "visits": return read ? "appointments:read" : "appointments:write";
    case "staff": return "staff:manage";
    case "audit": return "audit:read";
    case "files": return read ? "properties:read" : "properties:write";
    case "listing-images": return method === "POST" || method === "DELETE" ? "properties:write" : undefined;
    case "geospatial-profile": return read ? "properties:read" : "properties:write";
    default: return undefined;
  }
}

function auditAction(resource: string, method: string, path: string[], body: Record<string, unknown>) {
  if (resource === "properties") {
    if (path[1] === "approve") return "property.approve";
    if (method === "POST") return "property.create";
    return "availabilityStatus" in body && Object.keys(body).length === 1 ? "property.availability" : "property.update";
  }
  if (resource === "leads") {
    if (path[1] === "events") return "lead.note";
    if (path[1] === "reminders") return "lead.reminder";
    if (method === "POST") return "lead.create";
    return "assignedTo" in body ? "lead.assign" : "lead.stage";
  }
  if (resource === "reminders") return "reminder.done";
  if (resource === "appointments") return method === "POST" ? "appointment.create" : "appointment.status";
  if (resource === "visits") return "appointment.visit-change";
  if (resource === "staff") return "staff.upsert";
  if (resource === "files") return method === "DELETE" ? "file.delete" : "file.upload";
  if (resource === "listing-images") return method === "DELETE" ? "listing-image.delete" : "listing-image.upload";
  return `${resource}.${method.toLowerCase()}`;
}

async function recordAudit(config: AdminConfig, staff: StaffIdentity, resource: string, method: string, path: string[], snapshot: Request | null) {
  let body: Record<string, unknown> = {};
  if (snapshot) {
    try {
      const parsed: unknown = JSON.parse(await snapshot.text());
      if (isRecord(parsed)) body = parsed;
    } catch {
      body = {};
    }
  }
  const details: AuditDetails = {};
  for (const field of auditedFields) {
    const value = body[field];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) details[field] = value;
  }
  const entityId = path[0] && uuidPattern.test(path[0]) ? path[0] : resource === "staff" && typeof body.email === "string" ? body.email : null;
  await writeAudit(config, staff, auditAction(resource, method, path, body), resource, entityId, details);
}

export async function handleAdminRequest(request: Request, allowedOrigins: Set<string>) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return jsonError("Origine de la demande non autorisée.", 403);
  const config = getConfig();
  if (!config) return jsonError("L’administration n’est pas configurée.", 503);
  const user = await authenticate(request, config);
  if (user instanceof Response) return user;
  const staff = await resolveStaff(config, user);
  if (staff instanceof Response) return staff;
  if (!staff) return jsonError("Compte non autorisé.", 403);

  const { pathname } = new URL(request.url);
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "admin") return jsonError("Route introuvable.", 404);
  const resource = segments[2];
  const path = segments.slice(3);

  const permission = requiredPermission(resource, request.method, path);
  if (permission === undefined) return jsonError("Route introuvable.", 404);
  if (permission !== null && !can(staff, permission)) return jsonError("Votre rôle ne permet pas cette action.", 403);

  if (resource === "session" && request.method === "GET" && path.length === 0) {
    return Response.json({
      email: staff.email, role: staff.role, roleLabel: roleLabels[staff.role], permissions: staff.permissions, canReview: staff.canReview,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const mutating = request.method !== "GET";
  // Les envois de fichiers ne sont jamais relus pour le journal : seul le nom d'action est consigné.
  const snapshot = mutating && resource !== "files" && resource !== "listing-images" && resource !== "geospatial-profile" ? request.clone() : null;

  let response: Response;
  if (resource === "properties") {
    response = await handleProperties(request, config, path, user);
    if (request.method === "GET" && path.length === 0 && response.ok) {
      const listings: unknown = await response.json();
      if (!Array.isArray(listings)) return jsonError("Les annonces reçues sont invalides.", 503);
      const validListings = listings.filter((listing): listing is Record<string, unknown> & { photos: { src: string }[] } =>
        isRecord(listing) && Array.isArray(listing.photos) &&
        listing.photos.every((photo) => isRecord(photo) && typeof photo.src === "string"));
      if (validListings.length !== listings.length) return jsonError("Les annonces reçues sont invalides.", 503);
      const previews = await addAdminImagePreviews(config, validListings);
      if (!previews) return jsonError("Les aperçus privés des photos n’ont pas pu être chargés.", 503);
      response = Response.json(previews, { headers: { "Cache-Control": "no-store" } });
    }
  }
  else if (resource === "leads") response = await handleLeads(request, config, path, staff, user);
  else if (resource === "reminders") response = await handleReminders(request, config, path);
  else if (resource === "appointments") response = await handleAppointments(request, config, path, user);
  else if (resource === "visits") response = await handleVisits(request, config, path, null);
  else if (resource === "geospatial-profile") response = await handleGeospatialProfile(request, config, path);
  else if (resource === "staff") response = await handleStaff(request, config, path, staff);
  else if (resource === "audit") response = await handleAudit(request, config, path);
  else if (resource === "files") response = await handleFiles(request, config, path, user);
  else if (resource === "listing-images" && path.length === 0 && request.method === "POST") response = await handleListingImageUpload(request, config);
  else if (resource === "listing-images" && path.length === 0 && request.method === "DELETE") response = await handleListingImageDelete(request, config);
  else if (resource === "dashboard" && request.method === "GET" && path.length === 0) response = await loadDashboard(config);
  else return jsonError("Route introuvable.", 404);

  if (mutating && response.ok) await recordAudit(config, staff, resource, request.method, path, snapshot);
  return response;
}
