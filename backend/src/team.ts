import { databaseRequest, isRecord, jsonError, readJson, type AdminConfig } from "./admin";
import { bootstrapAdmins, isRole, roleLabels, roleNames, type StaffIdentity } from "./staff";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleStaff(request: Request, config: AdminConfig, path: string[], staff: StaffIdentity) {
  if (path.length !== 0) return jsonError("Route introuvable.", 404);

  if (request.method === "GET") {
    const response = await databaseRequest(config, "staff_members?select=email,role,active,created_at&order=email.asc&limit=500");
    if (!response.ok) return response;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return jsonError("La liste de l’équipe reçue est invalide.", 503);
    return Response.json({
      roles: roleNames.map((role) => ({ role, label: roleLabels[role] })),
      bootstrap: bootstrapAdmins(config).map((email) => ({ email, role: "admin", active: true, managedByEnvironment: true })),
      members: rows.filter(isRecord).filter((row) => typeof row.email === "string" && isRole(row.role)).map((row) => ({
        email: row.email, role: row.role, active: row.active !== false, managedByEnvironment: false,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  }

  if (request.method === "PUT") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    const email = isRecord(input) && typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (!isRecord(input) || !emailPattern.test(email) || email.length > 254 || !isRole(input.role) || typeof input.active !== "boolean" || Object.keys(input).length !== 3) {
      return jsonError("Indiquez une adresse, un rôle valide et l’état du compte.", 400);
    }
    if (bootstrapAdmins(config).includes(email)) {
      return jsonError("Cette adresse est un administrateur d’amorçage : elle se gère dans la configuration du serveur.", 400);
    }
    if (email === staff.email) return jsonError("Vous ne pouvez pas modifier votre propre accès.", 400);
    const result = await databaseRequest(config, "staff_members?on_conflict=email", "POST", {
      email, role: input.role, active: input.active, created_by: staff.id, updated_at: new Date().toISOString(),
    }, "resolution=merge-duplicates");
    if (!result.ok) return result;
    return Response.json({ saved: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
  return jsonError("Méthode non autorisée.", 405);
}

export async function handleAudit(request: Request, config: AdminConfig, path: string[]) {
  if (path.length !== 0 || request.method !== "GET") return jsonError("Route introuvable.", 404);
  const params = new URL(request.url).searchParams;
  const requestedLimit = Number(params.get("limit") ?? 100);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
  const before = params.get("before");
  if (before !== null && !/^\d{1,18}$/.test(before)) return jsonError("Paramètre de pagination invalide.", 400);

  const response = await databaseRequest(config, `audit_log?select=id,at,actor_email,action,entity,entity_id,details&order=id.desc&limit=${limit}${before ? `&id=lt.${before}` : ""}`);
  if (!response.ok) return response;
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return jsonError("Le journal reçu est invalide.", 503);
  return Response.json(rows.filter(isRecord).map((row) => ({
    id: row.id, at: row.at, actor: row.actor_email, action: row.action, entity: row.entity, entityId: row.entity_id ?? null, details: isRecord(row.details) ? row.details : {},
  })), { headers: { "Cache-Control": "no-store" } });
}
