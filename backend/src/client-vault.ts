import { randomUUID } from "node:crypto";
import { hasRecentPasswordAuthentication } from "./user-auth";
import type { VerifiedUser } from "./user-auth";

type VaultConfig = { baseUrl: string; serviceRoleKey: string };
const maxFileBytes = 10 * 1024 * 1024;
const maxFiles = 100;
const signedUrlSeconds = 60;
const allowedTypes = new Map([
  ["application/pdf", { extension: "pdf" }],
  ["image/jpeg", { extension: "jpg" }],
  ["image/png", { extension: "png" }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { extension: "docx" }],
]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function error(message: string, status: number) {
  return json({ error: message }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanName(value: string) {
  return (value.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
}

export function detectVaultType(bytes: Uint8Array, declaredType: string) {
  if (declaredType === "application/pdf" && bytes.length >= 4 &&
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true;
  if (declaredType === "image/jpeg" && bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (declaredType === "image/png" && bytes.length >= 8 &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return true;
  if (declaredType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchStart = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    const centralOffset = view.getUint32(offset + 16, true);
    const centralSize = view.getUint32(offset + 12, true);
    const centralEnd = centralOffset + centralSize;
    if (centralEnd > offset || centralEnd > bytes.length) return false;
    const names: string[] = [];
    for (let cursor = centralOffset; cursor + 46 <= centralEnd;) {
      if (view.getUint32(cursor, true) !== 0x02014b50) return false;
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const next = cursor + 46 + nameLength + extraLength + commentLength;
      if (next > centralEnd) return false;
      names.push(new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength)));
      cursor = next;
    }
    return names.includes("[Content_Types].xml") && names.includes("word/document.xml");
  }
  return false;
}

async function database(config: VaultConfig, path: string, method = "GET", body?: unknown, prefer?: string) {
  try {
    return await fetch(`${config.baseUrl}/rest/v1/${path}`, {
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
  } catch (reason) {
    console.error("Sama Kër client vault database unavailable", reason instanceof Error ? reason.message : "unknown error");
    return null;
  }
}

async function storage(config: VaultConfig, bucket: string, path: string, method: string, body?: Uint8Array | string, contentType?: string) {
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
        ...(body instanceof Uint8Array ? { "Content-Type": contentType ?? "application/octet-stream", "x-upsert": "false" } : { "Content-Type": "application/json" }),
      },
      ...(payload === undefined ? {} : { body: payload }),
      cache: "no-store",
    });
  } catch (reason) {
    console.error(`Sama Kër ${bucket} storage unavailable`, reason instanceof Error ? reason.message : "unknown error");
    return null;
  }
}

async function listRows(config: VaultConfig, path: string) {
  const response = await database(config, path);
  if (!response?.ok) return null;
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? rows.filter(isRecord) : null;
}

async function listAllRows(config: VaultConfig, path: string) {
  const result: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    const response = await database(config, `${path}&limit=500&offset=${offset}`);
    if (!response?.ok) return null;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return null;
    result.push(...rows.filter(isRecord));
    if (rows.length < 500) return result;
  }
  return null;
}

async function listVault(config: VaultConfig, user: VerifiedUser) {
  const files = await listRows(config, `client_vault_files?select=id,original_name,mime_type,size_bytes,created_at&user_id=eq.${user.id}&order=created_at.desc&limit=${maxFiles}`);
  if (!files) return error("Le coffre n’a pas pu être chargé.", 503);
  const accesses = await listRows(config, `client_vault_access_log?select=file_id,accessed_at&user_id=eq.${user.id}&order=accessed_at.desc&limit=200`);
  if (!accesses) return error("L’historique du coffre n’a pas pu être chargé.", 503);
  return json({
    files: files.filter((row) => typeof row.id === "string" && typeof row.original_name === "string")
      .map((row) => ({
        id: row.id, name: row.original_name, type: row.mime_type, sizeBytes: row.size_bytes, createdAt: row.created_at,
      })),
    accesses: accesses.filter((row) => typeof row.file_id === "string" && typeof row.accessed_at === "string")
      .map((row) => ({ fileId: row.file_id, accessedAt: row.accessed_at })),
    maxFiles,
    maxFileBytes,
  });
}

async function upload(config: VaultConfig, user: VerifiedUser, request: Request) {
  const type = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  const descriptor = allowedTypes.get(type);
  if (!descriptor) return error("Formats acceptés : PDF, JPEG, PNG et Word (.docx).", 415);
  let rawName = request.headers.get("x-file-name") ?? "";
  try {
    rawName = decodeURIComponent(rawName);
  } catch (reason) {
    if (reason instanceof URIError) return error("Nom de fichier invalide.", 400);
    throw reason;
  }
  const name = cleanName(rawName);
  if (!name) return error("Indiquez le nom du fichier.", 400);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxFileBytes) return error("Le fichier dépasse 10 Mo.", 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return error("Le fichier est vide.", 400);
  if (bytes.length > maxFileBytes) return error("Le fichier dépasse 10 Mo.", 413);
  if (!detectVaultType(bytes, type)) return error("Le contenu ne correspond pas au format annoncé.", 400);

  const existing = await listRows(config, `client_vault_files?select=id&user_id=eq.${user.id}&limit=${maxFiles + 1}`);
  if (!existing) return error("Le coffre n’est pas disponible.", 503);
  if (existing.length >= maxFiles) return error("Le coffre est limité à 100 fichiers.", 400);

  const objectPath = `client/${user.id}/${randomUUID()}.${descriptor.extension}`;
  const uploaded = await storage(config, "client-vault", `/object/client-vault/${objectPath}`, "POST", bytes, type);
  if (!uploaded?.ok) return error("Le fichier n’a pas pu être enregistré.", 503);
  const saved = await database(config, "rpc/save_client_vault_file", "POST", {
    p_user: user.id, p_object_path: objectPath, p_original_name: name, p_mime_type: type, p_size_bytes: bytes.length,
  });
  if (!saved?.ok) {
    const removed = await storage(config, "client-vault", "/object/client-vault", "DELETE", JSON.stringify({ prefixes: [objectPath] }));
    if (!removed?.ok) console.error("Sama Kër client vault orphan cleanup failed");
    if (saved?.status === 400) {
      const failure: unknown = await saved.json();
      if (isRecord(failure) && failure.code === "23514" && failure.message === "vault file limit reached") {
        return error("Le coffre est limité à 100 fichiers.", 400);
      }
    }
    return error("Le fichier n’a pas pu être enregistré.", 503);
  }
  const rows: unknown = await saved.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!isRecord(row) || typeof row.id !== "string") return error("Le fichier a été transmis mais sa référence est invalide.", 503);
  return json({ id: row.id }, 201);
}

async function download(config: VaultConfig, user: VerifiedUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error("Fichier invalide.", 400);
  const rows = await listRows(config, `client_vault_files?select=object_path&user_id=eq.${user.id}&id=eq.${id}&limit=1`);
  const row = rows?.[0];
  if (!row || typeof row.object_path !== "string") return error("Fichier introuvable.", 404);
  const signed = await storage(config, "client-vault", `/object/sign/client-vault/${row.object_path}`, "POST", JSON.stringify({ expiresIn: signedUrlSeconds }));
  if (!signed?.ok) return error("Le lien du fichier n’a pas pu être créé.", 503);
  const payload: unknown = await signed.json();
  const path = isRecord(payload) && typeof payload.signedURL === "string" ? payload.signedURL : "";
  if (!path.startsWith("/object/sign/client-vault/")) return error("Le lien du fichier est invalide.", 503);
  const url = new URL(`/storage/v1${path}`, config.baseUrl);
  if (url.origin !== config.baseUrl) return error("Le lien du fichier est invalide.", 503);
  const logged = await database(config, "rpc/log_client_vault_access", "POST", { p_user: user.id, p_file: id });
  if (!logged?.ok) return error("L’accès au fichier n’a pas pu être consigné.", 503);
  return json({ url: url.toString(), expiresInSeconds: signedUrlSeconds });
}

async function removeFile(config: VaultConfig, user: VerifiedUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error("Fichier invalide.", 400);
  const rows = await listRows(config, `client_vault_files?select=object_path&user_id=eq.${user.id}&id=eq.${id}&limit=1`);
  const row = rows?.[0];
  if (!row || typeof row.object_path !== "string") return error("Fichier introuvable.", 404);
  const removed = await storage(config, "client-vault", "/object/client-vault", "DELETE", JSON.stringify({ prefixes: [row.object_path] }));
  if (!removed?.ok) return error("Le fichier n’a pas pu être supprimé. Réessayez.", 503);
  const deleted = await database(config, `client_vault_files?id=eq.${id}&user_id=eq.${user.id}`, "DELETE", undefined, "return=minimal");
  if (!deleted?.ok) return error("Le fichier a été retiré du stockage, mais son entrée n’a pas pu être supprimée.", 503);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function removeClientPrivateObjects(config: VaultConfig, user: VerifiedUser) {
  const objects: { bucket: string; paths: string[] }[] = [];
  if (process.env.CLIENT_VAULT_ENABLED === "true") {
    const files = await listRows(config, `client_vault_files?select=object_path&user_id=eq.${user.id}&limit=500`);
    if (!files) return false;
    objects.push({ bucket: "client-vault", paths: files.flatMap((row) => typeof row.object_path === "string" ? [row.object_path] : []) });
  }
  if (process.env.CONSTRUCTION_WORK_ENABLED === "true") {
    const projects = await listAllRows(config, `construction_work_projects?select=id&client_user_id=eq.${user.id}`);
    if (!projects) return false;
    const projectIds = projects.flatMap((row) => typeof row.id === "string" ? [row.id] : []);
    const updates: Record<string, unknown>[] = [];
    for (let index = 0; index < projectIds.length; index += 50) {
      const batch = projectIds.slice(index, index + 50);
      const rows = await listAllRows(config, `construction_work_updates?select=id&project_id=in.(${batch.join(",")})`);
      if (!rows) return false;
      updates.push(...rows);
    }
    const updateIds = updates.flatMap((row) => typeof row.id === "string" ? [row.id] : []);
    const photos: Record<string, unknown>[] = [];
    for (let index = 0; index < updateIds.length; index += 50) {
      const batch = updateIds.slice(index, index + 50);
      const rows = await listAllRows(config, `construction_work_photos?select=object_path&update_id=in.(${batch.join(",")})`);
      if (!rows) return false;
      photos.push(...rows);
    }
    objects.push({ bucket: "construction-work", paths: photos.flatMap((row) => typeof row.object_path === "string" ? [row.object_path] : []) });
  }

  for (const { bucket, paths } of objects) {
    if (paths.length === 0) continue;
    const removed = await storage(config, bucket, `/object/${bucket}`, "DELETE", JSON.stringify({ prefixes: paths }));
    if (!removed?.ok) {
      console.error(`Sama Kër ${bucket} account cleanup failed`, removed?.status ?? "network");
      return false;
    }
  }
  return true;
}

export async function handleClientVault(request: Request, user: VerifiedUser, path: string[], config: VaultConfig): Promise<Response | null> {
  if (path[0] !== "vault") return null;
  if (process.env.CLIENT_VAULT_ENABLED !== "true") return error("Le coffre personnel est désactivé.", 503);
  const isList = path.length === 1 && request.method === "GET";
  const isUpload = path.length === 2 && path[1] === "files" && request.method === "POST";
  const isDownload = path.length === 3 && path[1] === "files" && request.method === "GET";
  const isDelete = path.length === 3 && path[1] === "files" && request.method === "DELETE";
  if (!isList && !isUpload && !isDownload && !isDelete) return null;
  if (!hasRecentPasswordAuthentication(request)) return error("Confirmez votre mot de passe pour accéder au coffre (authentification récente requise).", 428);

  if (isList) return listVault(config, user);
  if (isUpload) return upload(config, user, request);
  if (isDownload) return download(config, user, path[2]);
  return removeFile(config, user, path[2]);
}
