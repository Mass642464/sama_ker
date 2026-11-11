import { databaseRequest, isRecord, jsonError, leadStages, patchOne, readJson, validString, type AdminConfig, type AdminUser } from "./admin";
import type { StaffIdentity } from "./staff";

const uuidPattern = /^[0-9a-f-]{36}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const eventKinds = new Set(["note", "reply"]);

// Une affectation n'est possible que vers un administrateur ou un agent commercial actif.
async function isAssignable(config: AdminConfig, email: string) {
  if (config.allowedEmails.includes(email)) return true;
  const result = await databaseRequest(config, `staff_members?email=eq.${encodeURIComponent(email)}&active=eq.true&role=in.(admin,commercial)&select=email&limit=1`);
  if (!result.ok) return false;
  const rows: unknown = await result.json();
  return Array.isArray(rows) && rows.length === 1;
}

async function leadExists(config: AdminConfig, id: string) {
  const result = await databaseRequest(config, `crm_leads?id=eq.${id}&select=id&limit=1`);
  if (!result.ok) return result;
  const rows: unknown = await result.json();
  return Array.isArray(rows) && rows.length === 1;
}

async function recordEvent(config: AdminConfig, leadId: string, staff: StaffIdentity, kind: string, body: string) {
  const result = await databaseRequest(config, "lead_events", "POST", { lead_id: leadId, actor_email: staff.email, kind, body });
  if (!result.ok) console.error("Sama Kër lead event write failed", result.status);
}

export async function handleLeads(request: Request, config: AdminConfig, path: string[], staff: StaffIdentity, user: AdminUser) {
  if (path.length === 0 && request.method === "GET") {
    const response = await databaseRequest(config, "crm_leads?select=id,full_name,email,interest,source,message,pipeline_stage,created_at,user_id,assigned_to&order=created_at.desc&limit=500");
    if (!response.ok) return response;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return jsonError("Les prospects reçus sont invalides.", 503);
    const leads = rows.filter(isRecord).map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      interest: row.interest,
      source: row.source,
      message: row.message,
      pipeline_stage: row.pipeline_stage,
      created_at: row.created_at,
      has_account: typeof row.user_id === "string",
      assigned_to: typeof row.assigned_to === "string" ? row.assigned_to : null,
    }));
    return Response.json(leads, { headers: { "Cache-Control": "no-store" } });
  }

  if (path.length === 0 && request.method === "POST") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (!isRecord(input) || !validString(input.fullName, 2, 120) ||
      !validString(input.email, 3, 254) || !emailPattern.test(input.email) ||
      !validString(input.interest, 2, 240) || !validString(input.source, 2, 80) ||
      (input.message !== undefined && !validString(input.message, 0, 4000))) {
      return jsonError("Vérifiez les informations du prospect.", 400);
    }
    return databaseRequest(config, "crm_leads", "POST", {
      full_name: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      interest: input.interest.trim(),
      source: input.source.trim(),
      message: typeof input.message === "string" ? input.message.trim() : "",
      created_by: user.id,
    }, "return=representation");
  }

  if (path.length === 1 && uuidPattern.test(path[0]) && request.method === "PATCH") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (!isRecord(input) || Object.keys(input).length !== 1) return jsonError("Modification du prospect invalide.", 400);

    if (typeof input.pipelineStage === "string" && leadStages.has(input.pipelineStage)) {
      const result = await patchOne(config, `crm_leads?id=eq.${path[0]}&select=id`, {
        pipeline_stage: input.pipelineStage,
        updated_at: new Date().toISOString(),
      });
      if (result.ok) await recordEvent(config, path[0], staff, "stage", `Étape : ${input.pipelineStage}`);
      return result;
    }

    if ("assignedTo" in input) {
      const assignee = input.assignedTo === null ? null : typeof input.assignedTo === "string" && emailPattern.test(input.assignedTo.trim()) ? input.assignedTo.trim().toLowerCase() : undefined;
      if (assignee === undefined) return jsonError("Adresse de l’agent invalide.", 400);
      if (assignee !== null && !(await isAssignable(config, assignee))) {
        return jsonError("Seuls un administrateur ou un agent commercial actif peuvent se voir affecter un prospect.", 400);
      }
      const result = await patchOne(config, `crm_leads?id=eq.${path[0]}&select=id`, { assigned_to: assignee, updated_at: new Date().toISOString() });
      if (result.ok) await recordEvent(config, path[0], staff, "assignment", assignee ? `Affecté à ${assignee}` : "Affectation retirée");
      return result;
    }
    return jsonError("Modification du prospect invalide.", 400);
  }

  if (path.length === 2 && uuidPattern.test(path[0]) && path[1] === "events") {
    if (request.method === "GET") {
      const response = await databaseRequest(config, `lead_events?lead_id=eq.${path[0]}&select=id,at,actor_email,kind,body&order=at.desc&limit=200`);
      if (!response.ok) return response;
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) return jsonError("L’historique reçu est invalide.", 503);
      return Response.json(rows.filter(isRecord).map((row) => ({ id: row.id, at: row.at, actor: row.actor_email, kind: row.kind, body: row.body })), { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method === "POST") {
      const input = await readJson(request);
      if (input instanceof Response) return input;
      if (!isRecord(input) || typeof input.kind !== "string" || !eventKinds.has(input.kind) || !validString(input.body, 1, 2000) || Object.keys(input).length !== 2) {
        return jsonError("Saisissez une note ou une réponse de 1 à 2 000 caractères.", 400);
      }
      const exists = await leadExists(config, path[0]);
      if (exists instanceof Response) return exists;
      if (!exists) return jsonError("Prospect introuvable.", 404);
      const result = await databaseRequest(config, "lead_events", "POST", { lead_id: path[0], actor_email: staff.email, kind: input.kind, body: input.body.trim() });
      if (!result.ok) return result;
      return Response.json({ created: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
  }

  if (path.length === 2 && uuidPattern.test(path[0]) && path[1] === "reminders" && request.method === "POST") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    const dueAt = isRecord(input) && typeof input.dueAt === "string" ? Date.parse(input.dueAt) : NaN;
    const horizon = Date.now() + 2 * 365 * 24 * 3600 * 1000;
    if (!isRecord(input) || !Number.isFinite(dueAt) || dueAt > horizon || dueAt < Date.now() - 24 * 3600 * 1000 ||
      (input.note !== undefined && !validString(input.note, 0, 500))) {
      return jsonError("Indiquez une date de relance valide (dans les deux prochaines années).", 400);
    }
    let assignee: string | null = staff.email;
    if (input.assignedTo !== undefined) {
      assignee = typeof input.assignedTo === "string" && emailPattern.test(input.assignedTo.trim()) ? input.assignedTo.trim().toLowerCase() : null;
      if (!assignee || !(await isAssignable(config, assignee))) return jsonError("Agent de relance invalide.", 400);
    }
    const exists = await leadExists(config, path[0]);
    if (exists instanceof Response) return exists;
    if (!exists) return jsonError("Prospect introuvable.", 404);
    const result = await databaseRequest(config, "lead_reminders", "POST", {
      lead_id: path[0],
      due_at: new Date(dueAt).toISOString(),
      note: typeof input.note === "string" ? input.note.trim() : "",
      assigned_to: assignee,
      created_by: staff.email,
    });
    if (!result.ok) return result;
    await recordEvent(config, path[0], staff, "reminder", `Relance prévue le ${new Date(dueAt).toISOString().slice(0, 10)}`);
    return Response.json({ created: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  return jsonError("Route introuvable.", 404);
}

export async function handleReminders(request: Request, config: AdminConfig, path: string[]) {
  if (path.length === 0 && request.method === "GET") {
    const response = await databaseRequest(config, "lead_reminders?done_at=is.null&select=id,lead_id,due_at,note,assigned_to&order=due_at.asc&limit=200");
    if (!response.ok) return response;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return jsonError("Les relances reçues sont invalides.", 503);
    const reminders = rows.filter(isRecord).filter((row) => typeof row.lead_id === "string" && uuidPattern.test(row.lead_id));
    const names = new Map<string, string>();
    if (reminders.length > 0) {
      const ids = [...new Set(reminders.map((row) => row.lead_id as string))].join(",");
      const leads = await databaseRequest(config, `crm_leads?id=in.(${ids})&select=id,full_name`);
      if (!leads.ok) return leads;
      const leadRows: unknown = await leads.json();
      if (Array.isArray(leadRows)) for (const lead of leadRows.filter(isRecord)) if (typeof lead.id === "string" && typeof lead.full_name === "string") names.set(lead.id, lead.full_name);
    }
    return Response.json(reminders.map((row) => ({
      id: row.id, leadId: row.lead_id, leadName: names.get(row.lead_id as string) ?? "Prospect", dueAt: row.due_at, note: row.note, assignedTo: row.assigned_to ?? null,
    })), { headers: { "Cache-Control": "no-store" } });
  }

  if (path.length === 1 && uuidPattern.test(path[0]) && request.method === "PATCH") {
    const input = await readJson(request);
    if (input instanceof Response) return input;
    if (!isRecord(input) || input.done !== true || Object.keys(input).length !== 1) return jsonError("Modification de la relance invalide.", 400);
    return patchOne(config, `lead_reminders?id=eq.${path[0]}&select=id`, { done_at: new Date().toISOString() });
  }
  return jsonError("Route introuvable.", 404);
}
