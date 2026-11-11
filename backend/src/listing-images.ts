import { randomUUID } from "node:crypto";
import { databaseRequest, isRecord, jsonError, type AdminConfig } from "./admin";

const bucket = "listing-images";
export const maxImageBytes = 10 * 1024 * 1024 - 1;
const adminPreviewSeconds = 3600;
const publicPreviewSeconds = 60;
const objectPathPattern = /^[0-9a-f-]{36}\.(jpg|png|webp)$/i;
const imageTypes = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Uint8Array) => {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  } },
  "image/webp": { extension: "webp", signature: (bytes: Uint8Array) =>
    bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" },
} as const;
type ImageType = keyof typeof imageTypes;

function privateImageUrl(config: AdminConfig, objectPath: string) {
  return `${config.baseUrl}/storage/v1/object/authenticated/${bucket}/${objectPath}`;
}

function objectPathFromSource(config: AdminConfig, source: string) {
  try {
    const url = new URL(source);
    const prefix = `/storage/v1/object/authenticated/${bucket}/`;
    if (url.origin !== config.baseUrl || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    return objectPathPattern.test(path) ? path : null;
  } catch {
    return null;
  }
}

function hasPrivateImagePrefix(config: AdminConfig, source: string) {
  try {
    const url = new URL(source);
    return url.origin === config.baseUrl &&
      url.pathname.startsWith(`/storage/v1/object/authenticated/${bucket}/`);
  } catch {
    return false;
  }
}

async function storageRequest(
  config: AdminConfig,
  path: string,
  init: { method: string; body?: Uint8Array | string; headers?: Record<string, string> },
) {
  try {
    const body = init.body instanceof Uint8Array
      ? (() => {
        const bytes = new Uint8Array(init.body.byteLength);
        bytes.set(init.body);
        return new Blob([bytes.buffer]);
      })()
      : init.body;
    return await fetch(`${config.baseUrl}/storage/v1${path}`, {
      method: init.method,
      body,
      headers: { apikey: config.serviceRoleKey, Authorization: "Bearer " + config.serviceRoleKey, ...init.headers },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër listing image storage unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

async function deleteObject(config: AdminConfig, objectPath: string) {
  const response = await storageRequest(config, `/object/${bucket}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [objectPath] }),
    headers: { "Content-Type": "application/json" },
  });
  return response?.ok === true;
}

async function signedImageUrls(config: AdminConfig, objectPaths: string[], expiresIn: number) {
  const response = await storageRequest(config, `/object/sign/${bucket}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn, paths: objectPaths }),
    headers: { "Content-Type": "application/json" },
  });
  if (!response?.ok) return null;

  const payload: unknown = await response.json();
  if (!Array.isArray(payload) || payload.length !== objectPaths.length) return null;
  const urls = new Map<string, string>();
  for (let index = 0; index < payload.length; index += 1) {
    const item = payload[index];
    if (!isRecord(item)) return null;
    if (typeof item.path === "string" && item.path !== objectPaths[index]) return null;
    const signedPath = typeof item.signedURL === "string" ? item.signedURL
      : typeof item.signedUrl === "string" ? item.signedUrl : "";
    if (!signedPath.startsWith(`/object/sign/${bucket}/`)) return null;
    const url = new URL(`/storage/v1${signedPath}`, config.baseUrl);
    if (url.origin !== config.baseUrl || url.pathname !== `/storage/v1/object/sign/${bucket}/${objectPaths[index]}`) return null;
    urls.set(objectPaths[index], url.toString());
  }
  return urls;
}

export async function addAdminImagePreviews<T extends { photos: { src: string }[] }>(config: AdminConfig, listings: T[]) {
  const paths = new Set<string>();
  for (const listing of listings) {
    for (const photo of listing.photos) {
      const path = objectPathFromSource(config, photo.src);
      if (hasPrivateImagePrefix(config, photo.src) && !path) return null;
      if (path) paths.add(path);
    }
  }

  const signed = new Map<string, string>();
  const uniquePaths = [...paths];
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const batch = uniquePaths.slice(index, index + 100);
    const batchUrls = await signedImageUrls(config, batch, adminPreviewSeconds);
    if (!batchUrls) return null;
    for (const [path, url] of batchUrls) signed.set(path, url);
  }

  return listings.map((listing) => ({
    ...listing,
    photos: listing.photos.map((photo) => {
      const path = objectPathFromSource(config, photo.src);
      return path && signed.has(path) ? { ...photo, previewSrc: signed.get(path) } : photo;
    }),
  }));
}

export async function handleListingImageUpload(request: Request, config: AdminConfig) {
  const declaredType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!(declaredType in imageTypes)) return jsonError("Formats autorisés : JPG, PNG ou WebP.", 415);
  const type = declaredType as ImageType;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > maxImageBytes) return jsonError("Chaque photo doit faire moins de 10 Mo.", 413);

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return jsonError("La photo est vide.", 400);
  if (bytes.length > maxImageBytes) return jsonError("Chaque photo doit faire moins de 10 Mo.", 413);
  if (!imageTypes[type].signature(bytes)) return jsonError("Le contenu de la photo ne correspond pas au format annoncé.", 400);

  const objectPath = `${randomUUID()}.${imageTypes[type].extension}`;
  const uploaded = await storageRequest(config, `/object/${bucket}/${objectPath}`, {
    method: "POST",
    body: bytes,
    headers: { "Content-Type": type, "x-upsert": "false" },
  });
  if (!uploaded?.ok) return jsonError("La photo n’a pas pu être enregistrée dans le stockage privé.", 503);

  const urls = await signedImageUrls(config, [objectPath], adminPreviewSeconds);
  const previewSrc = urls?.get(objectPath);
  if (!previewSrc) {
    if (!(await deleteObject(config, objectPath))) {
      console.error("Sama Kër listing image cleanup failed", objectPath);
      return jsonError("L’aperçu n’a pas pu être créé et la photo privée doit être supprimée manuellement.", 503);
    }
    return jsonError("L’aperçu privé de la photo n’a pas pu être créé.", 503);
  }

  return Response.json({
    src: privateImageUrl(config, objectPath),
    previewSrc,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function handleListingImageDelete(request: Request, config: AdminConfig) {
  const source = new URL(request.url).searchParams.get("src") ?? "";
  const objectPath = objectPathFromSource(config, source);
  if (!objectPath) return jsonError("La référence de photo privée est invalide.", 400);

  const referenced = await databaseRequest(config, `property_listing_media?select=id&image_url=eq.${encodeURIComponent(source)}&limit=1`);
  if (!referenced.ok) return referenced;
  const rows: unknown = await referenced.json();
  if (!Array.isArray(rows)) return jsonError("La référence de la photo n’a pas pu être vérifiée.", 503);
  if (rows.length > 0) return jsonError("Cette photo est déjà liée à une annonce et ne peut pas être supprimée ici.", 409);

  if (!(await deleteObject(config, objectPath))) return jsonError("La photo privée n’a pas pu être supprimée. Réessayez.", 503);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function handlePublicListingImage(request: Request, config: AdminConfig, path: string[]) {
  if (request.method !== "GET" || path.length !== 1 || !objectPathPattern.test(path[0])) {
    return jsonError("Route introuvable.", 404);
  }

  const source = privateImageUrl(config, path[0]);
  const media = await databaseRequest(
    config,
    `property_listing_media?select=property_id&image_url=eq.${encodeURIComponent(source)}&is_published=eq.true&limit=2`,
  );
  if (!media.ok) return media;
  const mediaRows: unknown = await media.json();
  const mediaRow = Array.isArray(mediaRows) && mediaRows.length === 1 ? mediaRows[0] : null;
  if (!isRecord(mediaRow) || typeof mediaRow.property_id !== "string" || !/^[0-9a-f-]{36}$/i.test(mediaRow.property_id)) {
    return jsonError("Photo introuvable.", 404);
  }

  const listing = await databaseRequest(
    config,
    `property_listings?select=id&id=eq.${mediaRow.property_id}&publication_status=eq.published&limit=1`,
  );
  if (!listing.ok) return listing;
  const listingRows: unknown = await listing.json();
  if (!Array.isArray(listingRows) || listingRows.length !== 1) return jsonError("Photo introuvable.", 404);

  const signed = await signedImageUrls(config, [path[0]], publicPreviewSeconds);
  const location = signed?.get(path[0]);
  if (!location) return jsonError("La photo publiée est momentanément indisponible.", 503);
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "private, max-age=30" },
  });
}
