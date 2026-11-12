import { getAuthConfig, verifyUser } from "./user-auth";
import { handleClientExtras } from "./client-extras";
import { handleClientVault } from "./client-vault";
import { handleClientConstructionWork } from "./construction-work";
import { handleVisits } from "./visits";

const stageStatuses: Record<string, string> = {
  "Nouveau": "received",
  "À qualifier": "qualifying",
  "Visite planifiée": "visit_planned",
  "Dossier ouvert": "file_open",
  "Fermé": "closed",
};

type ServiceConfig = { baseUrl: string; serviceRoleKey: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function query(config: ServiceConfig, path: string): Promise<unknown[] | Response> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
      headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër client database unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("Vos demandes sont momentanément indisponibles.", 503);
  }
  if (!response.ok) {
    console.error("Sama Kër client database returned", response.status);
    return jsonError("Vos demandes sont momentanément indisponibles.", 503);
  }
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return jsonError("Vos demandes sont momentanément indisponibles.", 503);
  return rows;
}

// Ne retourne que des champs destinés au client : ni notes internes, ni e-mail d’un tiers, ni lieu de rendez-vous.
async function listRequests(config: ServiceConfig, userId: string) {
  const leads = await query(
    config,
    `crm_leads?select=id,interest,message,pipeline_stage,created_at,updated_at&user_id=eq.${userId}&order=created_at.desc&limit=50`,
  );
  if (leads instanceof Response) return leads;

  const leadRows = leads.filter(isRecord).filter((lead) => typeof lead.id === "string" && /^[0-9a-f-]{36}$/i.test(lead.id));
  const appointmentsByLead = new Map<string, { id: string; startsAt: string; status: string }[]>();
  if (leadRows.length > 0) {
    const ids = leadRows.map((lead) => lead.id as string).join(",");
    const appointments = await query(
      config,
      `admin_appointments?select=id,lead_id,starts_at,status&lead_id=in.(${ids})&order=starts_at.asc&limit=200`,
    );
    if (appointments instanceof Response) return appointments;
    for (const appointment of appointments.filter(isRecord)) {
      if (typeof appointment.lead_id !== "string" || typeof appointment.id !== "string" ||
        typeof appointment.starts_at !== "string" || typeof appointment.status !== "string") continue;
      const list = appointmentsByLead.get(appointment.lead_id) ?? [];
      list.push({ id: appointment.id, startsAt: appointment.starts_at, status: appointment.status });
      appointmentsByLead.set(appointment.lead_id, list);
    }
  }

  const requests = leadRows.map((lead) => ({
    id: lead.id as string,
    title: typeof lead.interest === "string" ? lead.interest : "Demande",
    message: typeof lead.message === "string" ? lead.message : "",
    status: typeof lead.pipeline_stage === "string" ? stageStatuses[lead.pipeline_stage] ?? "received" : "received",
    createdAt: typeof lead.created_at === "string" ? lead.created_at : null,
    updatedAt: typeof lead.updated_at === "string" ? lead.updated_at : null,
    appointments: appointmentsByLead.get(lead.id as string) ?? [],
  }));
  return Response.json({ requests }, { headers: { "Cache-Control": "no-store" } });
}

export async function handleClientRequest(request: Request, allowedOrigins: Set<string>) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) return jsonError("Origine de la demande non autorisée.", 403);

  const auth = getAuthConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!auth || !serviceRoleKey) return jsonError("L’espace client n’est pas configuré.", 503);

  const user = await verifyUser(request, auth);
  if (user instanceof Response) return user;

  const { pathname } = new URL(request.url);
  if (pathname === "/api/client/visits" || pathname.startsWith("/api/client/visits/")) {
    const path = pathname.slice("/api/client/visits".length).split("/").filter(Boolean);
    return handleVisits(request, { baseUrl: auth.baseUrl, serviceRoleKey }, path, user.id);
  }
  if (pathname === "/api/client/requests" && request.method === "GET") {
    return listRequests({ baseUrl: auth.baseUrl, serviceRoleKey }, user.id);
  }
  if (pathname.startsWith("/api/client/")) {
    const path = pathname.slice("/api/client/".length).split("/").filter(Boolean);
    const vault = await handleClientVault(request, user, path, { baseUrl: auth.baseUrl, serviceRoleKey });
    if (vault) return vault;
    const work = await handleClientConstructionWork(user, path, { baseUrl: auth.baseUrl, serviceRoleKey });
    if (work) return work;
    const extra = await handleClientExtras(request, user, path);
    if (extra) return extra;
  }
  return jsonError("Route introuvable.", 404);
}
