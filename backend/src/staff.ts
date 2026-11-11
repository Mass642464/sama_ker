import { databaseRequest, isRecord, type AdminConfig, type AdminUser } from "./admin";

export type Role = "admin" | "responsable" | "commercial" | "technique" | "direction";

export type Permission =
  | "dashboard:read"
  | "properties:read"
  | "properties:write"
  | "properties:review"
  | "leads:read"
  | "leads:write"
  | "appointments:read"
  | "appointments:write"
  | "staff:manage"
  | "audit:read";

export const roleLabels: Record<Role, string> = {
  admin: "Administrateur",
  responsable: "Responsable de validation",
  commercial: "Agent commercial",
  technique: "Agent technique",
  direction: "Direction (lecture)",
};

// Le droit de valider une annonce (properties:review) n'est volontairement attribué qu'au rôle « responsable »
// ou aux adresses de LISTING_REVIEWER_EMAILS : un administrateur ne valide pas ses propres modifications.
export const rolePermissions: Record<Role, Permission[]> = {
  admin: ["dashboard:read", "properties:read", "properties:write", "leads:read", "leads:write", "appointments:read", "appointments:write", "staff:manage", "audit:read"],
  responsable: ["dashboard:read", "properties:read", "properties:review", "leads:read", "appointments:read"],
  commercial: ["dashboard:read", "properties:read", "leads:read", "leads:write", "appointments:read", "appointments:write"],
  technique: ["dashboard:read", "properties:read", "properties:write"],
  direction: ["dashboard:read", "properties:read", "leads:read", "appointments:read", "audit:read"],
};

export const roleNames = Object.keys(rolePermissions) as Role[];

export type StaffIdentity = {
  id: string;
  email: string;
  role: Role;
  source: "env" | "table";
  permissions: Permission[];
  canReview: boolean;
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roleNames as string[]).includes(value);
}

export function bootstrapAdmins(config: AdminConfig) {
  return config.allowedEmails;
}

function reviewerEmails() {
  return process.env.LISTING_REVIEWER_EMAILS?.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean) ?? [];
}

function identity(user: AdminUser, role: Role, source: "env" | "table"): StaffIdentity {
  const permissions = [...rolePermissions[role]];
  const canReview = role === "responsable" || reviewerEmails().includes(user.email);
  if (canReview && !permissions.includes("properties:review")) permissions.push("properties:review");
  return { id: user.id, email: user.email, role, source, permissions, canReview };
}

// Retourne l'identité d'équipe, `null` si le compte n'appartient pas à l'équipe, ou une réponse d'erreur.
export async function resolveStaff(config: AdminConfig, user: AdminUser): Promise<StaffIdentity | null | Response> {
  // Les adresses de ADMIN_EMAILS sont des administrateurs d'amorçage : elles ne dépendent pas de la base.
  if (config.allowedEmails.includes(user.email)) return identity(user, "admin", "env");

  const result = await databaseRequest(config, `staff_members?email=eq.${encodeURIComponent(user.email)}&active=eq.true&select=role&limit=1`);
  if (!result.ok) return result;
  const rows: unknown = await result.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!isRecord(row) || !isRole(row.role)) {
    // Un responsable désigné par variable d'environnement reste habilité sans entrée dans la table.
    return reviewerEmails().includes(user.email) ? identity(user, "responsable", "env") : null;
  }
  return identity(user, row.role, "table");
}

export function can(staff: StaffIdentity, permission: Permission) {
  return staff.permissions.includes(permission);
}

export type AuditDetails = Record<string, string | number | boolean | null>;

// Ajout au journal d'audit. Un échec d'écriture est journalisé sans bloquer l'action déjà effectuée.
export async function writeAudit(config: AdminConfig, staff: StaffIdentity, action: string, entity: string, entityId: string | null, details: AuditDetails = {}) {
  try {
    const result = await databaseRequest(config, "audit_log", "POST", {
      actor_id: staff.id,
      actor_email: staff.email,
      action,
      entity,
      entity_id: entityId,
      details,
    });
    if (!result.ok) console.error("Sama Kër audit log write failed", result.status);
  } catch (error) {
    console.error("Sama Kër audit log write failed", error instanceof Error ? error.message : "unknown error");
  }
}
