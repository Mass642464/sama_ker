import { randomUUID } from "node:crypto";
import { isRecord, jsonError, readJson, type AdminConfig } from "./admin";
import type { VerifiedUser } from "./user-auth";
import { can, type StaffIdentity } from "./staff";

const phases = [
  "Préparation",
  "Fondations",
  "Gros œuvre",
  "Toiture",
  "Second œuvre",
  "Électricité et plomberie",
  "Finitions",
  "Réception",
] as const;
const uuidPattern = /^[0-9a-f-]{36}$/i;
const maxPhotoBytes = 10 * 1024 * 1024;
const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

type WorkConfig = { baseUrl: string; serviceRoleKey: string; allowedEmails?: string[] };

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function unauthorized() {
  return jsonError("Cet espace Travaux est désactivé.", 503);
}

async function requestRows(config: WorkConfig, path: string, method = "GET", body?: unknown, prefer?: string) {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër construction database unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
  if (!response.ok) {
    console.error("Sama Kër construction database returned", response.status);
    return jsonError("Le service Travaux est momentanément indisponible.", 503);
  }
  if (method === "DELETE" || prefer?.includes("return=minimal")) return [];
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? rows.filter(isRecord) : null;
}

async function storage(config: WorkConfig, path: string, method: string, body?: Uint8Array | string, contentType?: string) {
  try {
    let payload: Blob | string | undefined;
    if (body instanceof Uint8Array) {
      const copy = new ArrayBuffer(body.byteLength);
      new Uint8Array(copy).set(body);
      payload = new Blob([copy]);
    } else if (body !== undefined) {
      payload = body;
    }
    return await fetch(`${config.baseUrl}/storage/v1${path}`, {
      method,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        ...(body instanceof Uint8Array
          ? { "Content-Type": contentType ?? "application/octet-stream", "x-upsert": "false" }
          : { "Content-Type": "application/json" }),
      },
      ...(payload === undefined ? {} : { body: payload }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër construction storage unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

async function signedPhoto(config: WorkConfig, objectPath: string) {
  const result = await storage(config, `/object/sign/construction-work/${objectPath}`, "POST", JSON.stringify({ expiresIn: 60 }));
  if (!result?.ok) return null;
  const payload: unknown = await result.json();
  const path = isRecord(payload) && typeof payload.signedURL === "string" ? payload.signedURL : "";
  if (!path.startsWith("/object/sign/construction-work/")) return null;
  const url = new URL(`/storage/v1${path}`, config.baseUrl);
  return url.origin === config.baseUrl ? url.toString() : null;
}

function scopedPath(staff: StaffIdentity) {
  return staff.role === "responsable_travaux"
    ? `&assigned_to=eq.${encodeURIComponent(staff.email)}`
    : "";
}

async function projectsForStaff(config: WorkConfig, staff: StaffIdentity) {
  const projects = await requestRows(
    config,
    `construction_work_projects?select=id,client_email,assigned_to,title,description,created_at,updated_at&order=updated_at.desc&limit=500${scopedPath(staff)}`,
  );
  if (!projects) return jsonError("Les chantiers n’ont pas pu être chargés.", 503);
  if (projects instanceof Response) return projects;
  return projects;
}

async function projectBundle(config: WorkConfig, projectRows: Record<string, unknown>[], includeDrafts: boolean) {
  const ids = projectRows.flatMap((row) => typeof row.id === "string" && uuidPattern.test(row.id) ? [row.id] : []);
  const phasesRows = ids.length ? await requestRows(config, `construction_work_phases?select=project_id,phase_index,title,status,updated_at&project_id=in.(${ids.join(",")})&order=phase_index.asc&limit=4000`) : [];
  const updatesRows = ids.length ? await requestRows(config, `construction_work_updates?select=id,project_id,phase_index,body,status,created_at,published_at,created_by&project_id=in.(${ids.join(",")})${includeDrafts ? "" : "&status=eq.published"}&order=created_at.desc&limit=4000`) : [];
  if (!phasesRows || !updatesRows) return jsonError("Le suivi des chantiers n’a pas pu être chargé.", 503);
  if (phasesRows instanceof Response || updatesRows instanceof Response) return phasesRows instanceof Response ? phasesRows : updatesRows;

  const updateIds = updatesRows.flatMap((row) => typeof row.id === "string" ? [row.id] : []);
  const photoRows = updateIds.length ? await requestRows(config, `construction_work_photos?select=id,update_id,object_path,original_name&update_id=in.(${updateIds.join(",")})&order=created_at.asc&limit=5000`) : [];
  if (!photoRows) return jsonError("Les photos des chantiers n’ont pas pu être chargées.", 503);
  if (photoRows instanceof Response) return photoRows;

  const photosByUpdate = new Map<string, { id: string; name: string; url: string }[]>();
  for (const photo of photoRows) {
    if (typeof photo.id !== "string" || typeof photo.update_id !== "string" ||
        typeof photo.object_path !== "string" || typeof photo.original_name !== "string") continue;
    const url = await signedPhoto(config, photo.object_path);
    if (!url) return jsonError("Une photo de chantier n’a pas pu être signée.", 503);
    const list = photosByUpdate.get(photo.update_id) ?? [];
    list.push({ id: photo.id, name: photo.original_name, url });
    photosByUpdate.set(photo.update_id, list);
  }

  const phasesByProject = new Map<string, Record<string, unknown>[]>();
  for (const phase of phasesRows) {
    if (typeof phase.project_id !== "string") continue;
    const list = phasesByProject.get(phase.project_id) ?? [];
    list.push(phase);
    phasesByProject.set(phase.project_id, list);
  }
  const updatesByProject = new Map<string, Record<string, unknown>[]>();
  for (const update of updatesRows) {
    if (typeof update.project_id !== "string" || typeof update.id !== "string") continue;
    const list = updatesByProject.get(update.project_id) ?? [];
    list.push({
      id: update.id,
      phase_index: update.phase_index,
      body: update.body,
      status: update.status,
      created_at: update.created_at,
      published_at: update.published_at,
      photos: photosByUpdate.get(update.id) ?? [],
    });
    updatesByProject.set(update.project_id, list);
  }
  return projectRows.map((project) => {
    const projectId = typeof project.id === "string" ? project.id : "";
    const projectPhases = phasesByProject.get(projectId) ?? [];
    const progress = projectPhases.length
      ? Math.round(projectPhases.reduce((sum, phase) => sum + (phase.status === "completed" ? 100 : phase.status === "in_progress" ? 50 : 0), 0) / projectPhases.length)
      : 0;
    return {
      id: project.id,
      ...(includeDrafts ? { clientEmail: project.client_email, assignedTo: project.assigned_to } : {}),
      title: project.title,
      description: project.description,
      progress,
      phases: projectPhases,
      updates: updatesByProject.get(projectId) ?? [],
    };
  });
}

async function listStaffProjects(config: WorkConfig, staff: StaffIdentity) {
  const projects = await projectsForStaff(config, staff);
  if (projects instanceof Response) return projects;
  const result = await projectBundle(config, projects, true);
  return result instanceof Response ? result : respond({ projects: result });
}

async function confirmedUserId(config: WorkConfig, email: string): Promise<string | null | Response> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/rpc/confirmed_user_id_for_email`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_email: email }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër confirmed user lookup unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("Le service d’authentification est indisponible.", 503);
  }
  if (!response.ok) {
    console.error("Sama Kër confirmed user lookup returned", response.status);
    return jsonError("Le compte client n’a pas pu être vérifié.", 503);
  }
  const result: unknown = await response.json();
  const id = typeof result === "string" ? result : Array.isArray(result) && typeof result[0] === "string" ? result[0] : "";
  return uuidPattern.test(id) ? id : null;
}

async function validateAssignee(config: WorkConfig, staff: StaffIdentity, email: string) {
  if (email === staff.email || config.allowedEmails?.includes(email)) return true;
  const rows = await requestRows(
    config,
    `staff_members?select=email,role&email=eq.${encodeURIComponent(email)}&active=eq.true&limit=1`,
  );
  if (!rows) return null;
  if (rows instanceof Response) return rows;
  return rows.some((row) => row.email === email && ["admin", "responsable_travaux"].includes(String(row.role)));
}

async function createProject(request: Request, config: WorkConfig, staff: StaffIdentity) {
  const input = await readJson(request);
  if (input instanceof Response) return input;
  const email = isRecord(input) && typeof input.clientEmail === "string" ? input.clientEmail.trim().toLowerCase() : "";
  const title = isRecord(input) && typeof input.title === "string" ? input.title.trim() : "";
  const description = isRecord(input) && typeof input.description === "string" ? input.description.trim() : "";
  const assignedTo = isRecord(input) && typeof input.assignedTo === "string" ? input.assignedTo.trim().toLowerCase() : staff.email;
  if (!isRecord(input) || Object.keys(input).some((key) => !["clientEmail", "title", "description", "assignedTo"].includes(key)) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      title.length < 3 || title.length > 160 || description.length > 2000 ||
      assignedTo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedTo)) {
    return jsonError("Renseignez une adresse client confirmée, un titre et une affectation valides.", 400);
  }
  if (staff.role === "responsable_travaux" && assignedTo !== staff.email) return jsonError("Vous ne pouvez créer que vos propres chantiers.", 403);
  if (assignedTo !== staff.email && !can(staff, "work:assign")) return jsonError("Votre rôle ne permet pas de réaffecter un chantier.", 403);
  const assignable = await validateAssignee(config, staff, assignedTo);
  if (assignable instanceof Response) return assignable;
  if (assignable === null) return jsonError("Le responsable n’a pas pu être vérifié.", 503);
  if (!assignable) return jsonError("Le responsable doit être un administrateur ou un membre actif Responsable travaux.", 400);
  const userId = await confirmedUserId(config, email);
  if (userId instanceof Response) return userId;
  if (!userId) return jsonError("Aucun compte client confirmé ne correspond à cette adresse.", 404);
  const created = await requestRows(config, "construction_work_projects", "POST", {
    client_user_id: userId, client_email: email, assigned_to: assignedTo,
    title, description, created_by: staff.id,
  }, "return=representation");
  if (!created) return jsonError("Le chantier n’a pas pu être créé.", 503);
  if (created instanceof Response) return created;
  const project = created[0];
  if (!project || typeof project.id !== "string") return jsonError("Le chantier créé n’a pas de référence valide.", 503);
  const phaseRows = phases.map((name, phase_index) => ({ project_id: project.id, phase_index, title: name }));
  const createdPhases = await requestRows(config, "construction_work_phases", "POST", phaseRows, "return=minimal");
  if (!createdPhases || createdPhases instanceof Response) {
    const cleanup = await requestRows(config, `construction_work_projects?id=eq.${project.id}`, "DELETE");
    if (!cleanup || cleanup instanceof Response) {
      return jsonError("Le chantier a été créé mais ses phases n’ont pas pu être ajoutées ni annulées. Contactez l’administration.", 503);
    }
    return jsonError("Les phases standard n’ont pas pu être ajoutées ; le chantier a été annulé.", 503);
  }
  return respond({ id: project.id }, 201);
}

async function updateProject(request: Request, config: WorkConfig, staff: StaffIdentity, id: string) {
  if (!uuidPattern.test(id)) return jsonError("Chantier invalide.", 400);
  const rows = await requestRows(config, `construction_work_projects?select=id,assigned_to&id=eq.${id}&limit=1`);
  if (!rows) return jsonError("Le chantier n’a pas pu être vérifié.", 503);
  if (rows instanceof Response) return rows;
  const project = rows[0];
  if (!project) return jsonError("Chantier introuvable.", 404);
  if (staff.role === "responsable_travaux" && project.assigned_to !== staff.email) return jsonError("Chantier introuvable.", 404);
  const input = await readJson(request);
  if (input instanceof Response) return input;
  if (!isRecord(input) || Object.keys(input).some((key) => !["title", "description", "assignedTo"].includes(key))) return jsonError("Modification invalide.", 400);
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim().length < 3 || input.title.trim().length > 160) return jsonError("Titre invalide.", 400);
    body.title = input.title.trim();
  }
  if (input.description !== undefined) {
    if (typeof input.description !== "string" || input.description.trim().length > 2000) return jsonError("Description invalide.", 400);
    body.description = input.description.trim();
  }
  if (input.assignedTo !== undefined) {
    const email = typeof input.assignedTo === "string" ? input.assignedTo.trim().toLowerCase() : "";
    if (!can(staff, "work:assign")) return jsonError("Votre rôle ne permet pas de réaffecter un chantier.", 403);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return jsonError("Affectation invalide.", 400);
    const assignable = await validateAssignee(config, staff, email);
    if (assignable instanceof Response) return assignable;
    if (assignable === null) return jsonError("Le responsable n’a pas pu être vérifié.", 503);
    if (!assignable) return jsonError("Le responsable doit être un administrateur ou un membre actif Responsable travaux.", 400);
    body.assigned_to = email;
  }
  if (Object.keys(body).length === 0) return jsonError("Aucun champ à modifier.", 400);
  body.updated_at = new Date().toISOString();
  const updated = await requestRows(config, `construction_work_projects?id=eq.${id}`, "PATCH", body, "return=minimal");
  return updated instanceof Response ? updated : updated ? respond({ saved: true }) : jsonError("Le chantier n’a pas pu être modifié.", 503);
}

async function updatePhase(request: Request, config: WorkConfig, staff: StaffIdentity, projectId: string, rawIndex: string) {
  const phaseIndex = Number(rawIndex);
  if (!uuidPattern.test(projectId) || !/^[0-7]$/.test(rawIndex)) return jsonError("Phase invalide.", 400);
  const projects = await requestRows(config, `construction_work_projects?select=id,assigned_to&id=eq.${projectId}&limit=1`);
  if (!projects) return jsonError("Le chantier n’a pas pu être vérifié.", 503);
  if (projects instanceof Response) return projects;
  if (!projects[0] || (staff.role === "responsable_travaux" && projects[0].assigned_to !== staff.email)) return jsonError("Chantier introuvable.", 404);
  const input = await readJson(request);
  if (input instanceof Response) return input;
  if (!isRecord(input) || Object.keys(input).length !== 1 ||
      !["pending", "in_progress", "completed"].includes(String(input.status))) return jsonError("Statut de phase invalide.", 400);
  const result = await requestRows(config, `construction_work_phases?project_id=eq.${projectId}&phase_index=eq.${phaseIndex}`, "PATCH", {
    status: input.status,
    updated_at: new Date().toISOString(),
  }, "return=minimal");
  return result instanceof Response ? result : result ? respond({ saved: true }) : jsonError("La phase n’a pas pu être modifiée.", 503);
}

async function createUpdate(request: Request, config: WorkConfig, staff: StaffIdentity, projectId: string) {
  if (!uuidPattern.test(projectId)) return jsonError("Chantier invalide.", 400);
  const projectRows = await requestRows(config, `construction_work_projects?select=id,assigned_to&id=eq.${projectId}&limit=1`);
  if (!projectRows) return jsonError("Le chantier n’a pas pu être vérifié.", 503);
  if (projectRows instanceof Response) return projectRows;
  if (!projectRows[0] || (staff.role === "responsable_travaux" && projectRows[0].assigned_to !== staff.email)) return jsonError("Chantier introuvable.", 404);
  const input = await readJson(request);
  if (input instanceof Response) return input;
  const phaseIndex = isRecord(input) ? input.phaseIndex : null;
  const body = isRecord(input) && typeof input.body === "string" ? input.body.trim() : "";
  if (!isRecord(input) || Object.keys(input).some((key) => !["phaseIndex", "body"].includes(key)) ||
      !Number.isInteger(phaseIndex) || (phaseIndex as number) < 0 || (phaseIndex as number) >= phases.length ||
      body.length < 1 || body.length > 2000) return jsonError("Mise à jour invalide.", 400);
  const created = await requestRows(config, "construction_work_updates", "POST", {
    project_id: projectId, phase_index: phaseIndex, body, status: "draft", created_by: staff.id,
  }, "return=representation");
  if (!created) return jsonError("La mise à jour n’a pas pu être créée.", 503);
  if (created instanceof Response) return created;
  const update = created[0];
  return update && typeof update.id === "string" ? respond({ id: update.id }, 201) : jsonError("La mise à jour créée est invalide.", 503);
}

async function updateDraft(request: Request, config: WorkConfig, staff: StaffIdentity, updateId: string) {
  if (!uuidPattern.test(updateId)) return jsonError("Mise à jour invalide.", 400);
  const updates = await requestRows(config, `construction_work_updates?select=id,project_id,status,phase_index&id=eq.${updateId}&limit=1`);
  if (!updates) return jsonError("La mise à jour n’a pas pu être vérifiée.", 503);
  if (updates instanceof Response) return updates;
  const update = updates[0];
  if (!update || update.status !== "draft" || typeof update.project_id !== "string") return jsonError("Brouillon introuvable ou déjà publié.", 404);
  const projects = await requestRows(config, `construction_work_projects?select=id,assigned_to&id=eq.${update.project_id}&limit=1`);
  if (!projects) return jsonError("Le chantier n’a pas pu être vérifié.", 503);
  if (projects instanceof Response) return projects;
  if (!projects[0] || (staff.role === "responsable_travaux" && projects[0].assigned_to !== staff.email)) return jsonError("Brouillon introuvable.", 404);
  const input = await readJson(request);
  if (input instanceof Response) return input;
  if (!isRecord(input) || Object.keys(input).some((key) => !["body", "phaseIndex"].includes(key))) return jsonError("Modification invalide.", 400);
  const body: Record<string, unknown> = {};
  if (input.body !== undefined) {
    if (typeof input.body !== "string" || input.body.trim().length < 1 || input.body.trim().length > 2000) return jsonError("Texte invalide.", 400);
    body.body = input.body.trim();
  }
  if (input.phaseIndex !== undefined) {
    if (!Number.isInteger(input.phaseIndex) || (input.phaseIndex as number) < 0 || (input.phaseIndex as number) >= phases.length) return jsonError("Phase invalide.", 400);
    body.phase_index = input.phaseIndex;
  }
  if (Object.keys(body).length === 0) return jsonError("Aucun champ à modifier.", 400);
  const saved = await requestRows(config, `construction_work_updates?id=eq.${updateId}`, "PATCH", body, "return=minimal");
  return saved instanceof Response ? saved : saved ? respond({ saved: true }) : jsonError("Le brouillon n’a pas pu être modifié.", 503);
}

async function publishUpdate(config: WorkConfig, staff: StaffIdentity, updateId: string) {
  if (!uuidPattern.test(updateId)) return jsonError("Mise à jour invalide.", 400);
  const rows = await requestRows(config, `construction_work_updates?select=id,project_id,status&id=eq.${updateId}&limit=1`);
  if (!rows) return jsonError("La mise à jour n’a pas pu être vérifiée.", 503);
  if (rows instanceof Response) return rows;
  const update = rows[0];
  if (!update || update.status !== "draft" || typeof update.project_id !== "string") return jsonError("Brouillon introuvable ou déjà publié.", 404);
  const projects = await requestRows(config, `construction_work_projects?select=id,assigned_to&id=eq.${update.project_id}&limit=1`);
  if (!projects) return jsonError("Le chantier n’a pas pu être vérifié.", 503);
  if (projects instanceof Response) return projects;
  if (!projects[0] || (staff.role === "responsable_travaux" && projects[0].assigned_to !== staff.email)) return jsonError("Brouillon introuvable.", 404);
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/rpc/publish_construction_work_update`, {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_update: updateId }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër construction publish unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("La publication n’a pas pu être effectuée.", 503);
  }
  if (!response.ok) {
    console.error("Sama Kër construction publish returned", response.status);
    return jsonError("La publication n’a pas pu être effectuée.", 503);
  }
  return respond({ published: true });
}

async function uploadPhoto(request: Request, config: WorkConfig, staff: StaffIdentity, updateId: string) {
  if (!uuidPattern.test(updateId)) return jsonError("Mise à jour invalide.", 400);
  const updates = await requestRows(config, `construction_work_updates?select=id,project_id,status&id=eq.${updateId}&limit=1`);
  if (!updates) return jsonError("La mise à jour n’a pas pu être vérifiée.", 503);
  if (updates instanceof Response) return updates;
  const update = updates[0];
  if (!update || update.status !== "draft" || typeof update.project_id !== "string") return jsonError("Les photos ne peuvent être ajoutées qu’à un brouillon.", 404);
  const projects = await requestRows(config, `construction_work_projects?select=id,assigned_to&id=eq.${update.project_id}&limit=1`);
  if (!projects) return jsonError("Le chantier n’a pas pu être vérifié.", 503);
  if (projects instanceof Response) return projects;
  if (!projects[0] || (staff.role === "responsable_travaux" && projects[0].assigned_to !== staff.email)) return jsonError("Brouillon introuvable.", 404);

  const type = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  const extension = imageTypes.get(type);
  if (!extension) return jsonError("Seules les photos JPEG et PNG sont acceptées.", 415);
  const name = (new URL(request.url).searchParams.get("name") ?? "").split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) ?? "";
  if (!name) return jsonError("Indiquez le nom de la photo.", 400);
  const bytes = new Uint8Array(await request.arrayBuffer());
  const valid = type === "image/jpeg"
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (bytes.length === 0 || bytes.length > maxPhotoBytes) return jsonError("La photo doit peser entre 1 octet et 10 Mo.", 413);
  if (!valid) return jsonError("Le contenu ne correspond pas au format annoncé.", 400);

  const existing = await requestRows(config, `construction_work_photos?select=id&update_id=eq.${updateId}&limit=21`);
  if (!existing) return jsonError("Les photos n’ont pas pu être vérifiées.", 503);
  if (existing instanceof Response) return existing;
  if (existing.length >= 20) return jsonError("Une mise à jour est limitée à 20 photos.", 400);

  const objectPath = `project/${update.project_id}/update/${updateId}/${randomUUID()}.${extension}`;
  const uploaded = await storage(config, `/object/construction-work/${objectPath}`, "POST", bytes, type);
  if (!uploaded?.ok) return jsonError("La photo n’a pas pu être enregistrée.", 503);
  const saved = await requestRows(config, "construction_work_photos", "POST", {
    update_id: updateId, object_path: objectPath, original_name: name, mime_type: type, size_bytes: bytes.length,
  }, "return=representation");
  if (!saved) {
    const removed = await storage(config, "/object/construction-work", "DELETE", JSON.stringify({ prefixes: [objectPath] }));
    if (!removed?.ok) console.error("Sama Kër construction orphan photo cleanup failed");
    return jsonError("La photo n’a pas pu être enregistrée.", 503);
  }
  if (saved instanceof Response) {
    const removed = await storage(config, "/object/construction-work", "DELETE", JSON.stringify({ prefixes: [objectPath] }));
    if (!removed?.ok) console.error("Sama Kër construction orphan photo cleanup failed");
    return saved;
  }
  return respond({ uploaded: true }, 201);
}

export async function handleAdminConstructionWork(request: Request, config: AdminConfig, path: string[], staff: StaffIdentity) {
  if (process.env.CONSTRUCTION_WORK_ENABLED !== "true") return unauthorized();
  const workConfig = config;
  if (path.length === 1 && path[0] === "projects" && request.method === "GET") return listStaffProjects(workConfig, staff);
  if (path.length === 1 && path[0] === "projects" && request.method === "POST") return createProject(request, workConfig, staff);
  if (path.length === 2 && path[0] === "projects" && request.method === "PATCH") return updateProject(request, workConfig, staff, path[1]);
  if (path.length === 4 && path[0] === "projects" && path[2] === "phases" && request.method === "PATCH") return updatePhase(request, workConfig, staff, path[1], path[3]);
  if (path.length === 3 && path[0] === "projects" && path[2] === "updates" && request.method === "POST") return createUpdate(request, workConfig, staff, path[1]);
  if (path.length === 3 && path[0] === "updates" && path[2] === "publish" && request.method === "POST") return publishUpdate(workConfig, staff, path[1]);
  if (path.length === 2 && path[0] === "updates" && request.method === "PATCH") return updateDraft(request, workConfig, staff, path[1]);
  if (path.length === 3 && path[0] === "updates" && path[2] === "photos" && request.method === "POST") return uploadPhoto(request, workConfig, staff, path[1]);
  return jsonError("Route introuvable.", 404);
}

export async function handleClientConstructionWork(user: VerifiedUser, path: string[], config: WorkConfig) {
  if (path.length !== 1 || path[0] !== "construction") return null;
  if (process.env.CONSTRUCTION_WORK_ENABLED !== "true") return unauthorized();
  const projects = await requestRows(config, `construction_work_projects?select=id,title,description,updated_at&client_user_id=eq.${user.id}&client_email=eq.${encodeURIComponent(user.email)}&order=updated_at.desc&limit=100`);
  if (!projects) return jsonError("Vos chantiers n’ont pas pu être chargés.", 503);
  if (projects instanceof Response) return projects;
  const result = await projectBundle(config, projects, false);
  return result instanceof Response ? result : respond({ projects: result });
}
