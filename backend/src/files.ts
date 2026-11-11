import { randomUUID } from "node:crypto";
import { databaseRequest, isRecord, jsonError, type AdminConfig, type AdminUser } from "./admin";

export const maxFileBytes = 10 * 1024 * 1024;
const signedUrlSeconds = 60;
const uuidPattern = /^[0-9a-f-]{36}$/i;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" } as const;
type AllowedType = keyof typeof extensions;

// Le type est vérifié sur le contenu réel (signature des premiers octets), pas seulement sur l'en-tête annoncé.
export function detectType(bytes: Uint8Array): AllowedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return null;
}

// Nom affiché : sans chemin, sans caractères de contrôle, 120 caractères au plus.
export function cleanFileName(raw: string) {
  const base = raw.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
}

async function storage(config: AdminConfig, path: string, init: { method: string; body?: Uint8Array | string | null; headers?: Record<string, string> }) {
  try {
    return await fetch(`${config.baseUrl}/storage/v1${path}`, {
      method: init.method,
      body: init.body instanceof Uint8Array ? new Blob([init.body as BlobPart]) : init.body,
      headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${config.serviceRoleKey}`, ...init.headers },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër private storage unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

async function removeObject(config: AdminConfig, objectPath: string) {
  const response = await storage(config, "/object/private-files", {
    method: "DELETE", body: JSON.stringify({ prefixes: [objectPath] }), headers: { "Content-Type": "application/json" },
  });
  return response?.ok === true;
}

async function listFiles(config: AdminConfig, propertyId: string) {
  if (!uuidPattern.test(propertyId)) return jsonError("Annonce invalide.", 400);
  const response = await databaseRequest(config, `listing_files?select=id,original_name,mime_type,size_bytes,created_at&property_id=eq.${propertyId}&order=created_at.desc&limit=100`);
  if (!response.ok) return response;
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return jsonError("La liste des fichiers reçue est invalide.", 503);
  return Response.json(rows.filter(isRecord).map((row) => ({
    id: row.id, name: row.original_name, type: row.mime_type, sizeBytes: row.size_bytes, createdAt: row.created_at,
  })), { headers: { "Cache-Control": "no-store" } });
}

async function uploadFile(request: Request, config: AdminConfig, user: AdminUser) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId") ?? "";
  if (!uuidPattern.test(propertyId)) return jsonError("Annonce invalide.", 400);
  const name = cleanFileName(url.searchParams.get("name") ?? "");
  if (name.length < 1) return jsonError("Indiquez le nom du fichier.", 400);

  const declared = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!(declared in extensions)) return jsonError("Format non autorisé : seuls les fichiers jpg, png et pdf sont acceptés.", 415);
  const type = declared as AllowedType;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > maxFileBytes + 1024) return jsonError("Le fichier dépasse 10 Mo.", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return jsonError("Le fichier est vide.", 400);
  if (bytes.length > maxFileBytes) return jsonError("Le fichier dépasse 10 Mo.", 413);
  if (detectType(bytes) !== type) return jsonError("Le contenu du fichier ne correspond pas au format annoncé.", 400);

  const listing = await databaseRequest(config, `property_listings?select=id&id=eq.${propertyId}&limit=1`);
  if (!listing.ok) return listing;
  const rows: unknown = await listing.json();
  if (!Array.isArray(rows) || rows.length !== 1) return jsonError("Annonce introuvable.", 404);

  const objectPath = `listing/${propertyId}/${randomUUID()}.${extensions[type]}`;
  const uploaded = await storage(config, `/object/private-files/${objectPath}`, {
    method: "POST", body: bytes, headers: { "Content-Type": type, "x-upsert": "false" },
  });
  if (!uploaded?.ok) return jsonError("Le fichier n’a pas pu être enregistré. Réessayez plus tard.", 503);

  const saved = await databaseRequest(config, "listing_files", "POST", {
    property_id: propertyId,
    object_path: objectPath,
    original_name: name,
    mime_type: type,
    size_bytes: bytes.length,
    uploaded_by: user.id,
  }, "return=representation");
  if (!saved.ok) {
    // Pas de fichier orphelin : si l'enregistrement échoue, l'objet envoyé est retiré.
    await removeObject(config, objectPath);
    return saved;
  }
  const created: unknown = await saved.json();
  const row = Array.isArray(created) ? created[0] : null;
  if (!isRecord(row) || typeof row.id !== "string") return jsonError("Le fichier n’a pas pu être enregistré.", 503);
  return Response.json({ id: row.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

async function loadFile(config: AdminConfig, id: string) {
  const response = await databaseRequest(config, `listing_files?select=object_path&id=eq.${id}&limit=1`);
  if (!response.ok) return response;
  const rows: unknown = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!isRecord(row) || typeof row.object_path !== "string") return jsonError("Fichier introuvable.", 404);
  return row.object_path;
}

async function signedDownload(config: AdminConfig, id: string) {
  const objectPath = await loadFile(config, id);
  if (typeof objectPath !== "string") return objectPath;
  const response = await storage(config, `/object/sign/private-files/${objectPath}`, {
    method: "POST", body: JSON.stringify({ expiresIn: signedUrlSeconds }), headers: { "Content-Type": "application/json" },
  });
  if (!response?.ok) return jsonError("Le lien de téléchargement n’a pas pu être créé.", 503);
  const payload: unknown = await response.json();
  const signed = isRecord(payload) && typeof payload.signedURL === "string" ? payload.signedURL : "";
  if (!signed.startsWith("/object/sign/private-files/")) return jsonError("Le lien de téléchargement est invalide.", 503);
  const link = new URL(`/storage/v1${signed}`, config.baseUrl);
  // Le lien doit rester sur le même service ; sinon il n'est pas renvoyé.
  if (link.origin !== config.baseUrl) return jsonError("Le lien de téléchargement est invalide.", 503);
  return Response.json({ url: link.toString(), expiresInSeconds: signedUrlSeconds }, { headers: { "Cache-Control": "no-store" } });
}

async function deleteFile(config: AdminConfig, id: string) {
  const objectPath = await loadFile(config, id);
  if (typeof objectPath !== "string") return objectPath;
  // La ligne n'est retirée qu'une fois l'objet supprimé : en cas d'échec, le fichier reste référencé et peut être retenté.
  if (!(await removeObject(config, objectPath))) return jsonError("Le fichier n’a pas pu être supprimé. Réessayez.", 503);
  const removed = await databaseRequest(config, `listing_files?id=eq.${id}`, "DELETE", undefined, "return=minimal");
  if (!removed.ok) return removed;
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function handleFiles(request: Request, config: AdminConfig, path: string[], user: AdminUser) {
  if (path.length === 0 && request.method === "GET") {
    return listFiles(config, new URL(request.url).searchParams.get("propertyId") ?? "");
  }
  if (path.length === 0 && request.method === "POST") return uploadFile(request, config, user);
  if (path.length === 2 && uuidPattern.test(path[0]) && path[1] === "url" && request.method === "GET") return signedDownload(config, path[0]);
  if (path.length === 1 && uuidPattern.test(path[0]) && request.method === "DELETE") return deleteFile(config, path[0]);
  return jsonError("Route introuvable.", 404);
}
