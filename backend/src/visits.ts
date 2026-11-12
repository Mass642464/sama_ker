import { isRecord, jsonError, readJson } from "./admin";

type VisitConfig = { baseUrl: string; serviceRoleKey: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clientActions = new Set(["accept_offer", "request_cancel", "request_reschedule"]);
const adminActions = new Set(["confirm", "accept_cancel", "reject_request", "propose"]);

async function rpc(config: VisitConfig, name: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër visit database unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("Le suivi des visites est momentanément indisponible.", 503);
  }
  if (!response.ok) {
    console.error("Sama Kër visit database returned", response.status);
    return jsonError("Le suivi des visites est momentanément indisponible.", 503);
  }
  try {
    return await response.json() as unknown;
  } catch (error) {
    console.error("Sama Kër visit database returned invalid JSON", error instanceof Error ? error.message : "unknown error");
    return jsonError("La réponse du service de visites est invalide.", 503);
  }
}

export async function handleVisits(request: Request, config: VisitConfig, path: string[], userId: string | null) {
  if (request.method === "GET" && path.length === 0) {
    const rawOffset = new URL(request.url).searchParams.get("offset") ?? "0";
    if (!/^\d{1,6}$/.test(rawOffset) || Number(rawOffset) % 50 !== 0) return jsonError("Page de visites invalide.", 400);
    const result = await rpc(config, "list_visit_workflows", { p_user: userId, p_offset: Number(rawOffset) });
    if (result instanceof Response) return result;
    if (!Array.isArray(result)) return jsonError("La réponse du service de visites est invalide.", 503);
    return Response.json({ visits: result.slice(0, 50), hasMore: result.length > 50 }, { headers: { "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST" || path.length !== 1 || !uuid.test(path[0])) return jsonError("Route introuvable.", 404);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isRecord(body) || typeof body.action !== "string" ||
    !(userId === null ? adminActions : clientActions).has(body.action) ||
    !Number.isSafeInteger(body.revision) || Number(body.revision) < 1 ||
    Object.keys(body).some((key) => !["action", "revision", "proposedAt"].includes(key))) {
    return jsonError("Action de visite invalide.", 400);
  }
  const needsDate = body.action === "propose" || body.action === "request_reschedule";
  if (needsDate) {
    if (typeof body.proposedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(body.proposedAt) ||
      !Number.isFinite(Date.parse(body.proposedAt)) || new Date(body.proposedAt).toISOString() !== body.proposedAt ||
      Date.parse(body.proposedAt) <= Date.now()) return jsonError("Choisissez une date et une heure futures valides.", 400);
  } else if (body.proposedAt !== undefined) return jsonError("Action de visite invalide.", 400);
  const result = await rpc(config, "transition_visit", {
    p_appointment: path[0], p_user: userId, p_action: body.action,
    p_proposed: needsDate ? body.proposedAt : null, p_revision: body.revision,
  });
  if (result instanceof Response) return result;
  if (result === false) return jsonError("Cette action n’est plus possible. Actualisez le suivi de la visite.", 409);
  if (result !== true) return jsonError("La réponse du service de visites est invalide.", 503);
  return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}
