import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getConfig, jsonError } from "./admin";
import { handleAdminRequest } from "./admin-router";
import { handleClientRequest } from "./client";
import { handleContactRequest, getAllowedOrigins } from "./contact";
import { handlePublicListingImage } from "./listing-images";

const MAX_BODY_BYTES = 8_192;
const MAX_ADMIN_BODY_BYTES = 16_384;
// Fichier de 10 Mo maximum plus une marge pour les en-têtes ; la limite exacte est appliquée par le module fichiers.
const MAX_FILE_BODY_BYTES = 10 * 1024 * 1024 + 1024;
const contactPath = "/api/contact";

function send(response: ServerResponse, result: Response, origin: string | null, allowedOrigins: Set<string>, allowedMethods = "POST, OPTIONS") {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.setHeader("Cache-Control", "no-store");

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", allowedMethods);
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Vary", "Origin");
  }

  if (!result.body) {
    response.end();
    return;
  }

  result.body.pipeTo(new WritableStream({
    write(chunk) {
      response.write(Buffer.from(chunk));
    },
    close() {
      response.end();
    },
    abort() {
      response.destroy();
    },
  })).catch(() => response.destroy());
}

function readBody(request: IncomingMessage, maxBytes: number) {
  return new Promise<Buffer | null>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    request.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) {
        request.resume();
        resolve(null);
        return;
      }
      chunks.push(buffer);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function toWebRequest(request: IncomingMessage, body: Buffer, binary = false) {
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "origin", "authorization"]) {
    const value = request.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }

  const method = request.method ?? "GET";
  return new Request(`http://backend.local${request.url ?? contactPath}`, {
    method,
    headers,
    ...(method === "GET" || method === "HEAD" ? {} : { body: binary ? new Uint8Array(body) : new TextDecoder().decode(body) }),
  });
}

export function createBackendServer() {
  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.size === 0) {
    throw new Error("Configure at least one frontend origin in ALLOWED_ORIGINS.");
  }

  return createServer(async (request, response) => {
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : null;
    const requestPath = request.url?.split("?")[0] ?? "";
    const isContactRoute = requestPath === contactPath || requestPath === "/api/contact/visits";
    const isAdminRoute = requestPath === "/api/admin" || requestPath.startsWith("/api/admin/");
    const isClientRoute = requestPath === "/api/client" || requestPath.startsWith("/api/client/");
    const isPublicListingImageRoute = /^\/api\/public\/listing-images\/[^/]+$/.test(requestPath);
    const corsMethods = isAdminRoute ? "GET, POST, PATCH, PUT, DELETE, OPTIONS" : isClientRoute ? "GET, POST, DELETE, OPTIONS" : isPublicListingImageRoute ? "GET, OPTIONS" : "POST, OPTIONS";

    if (!isContactRoute && !isAdminRoute && !isClientRoute && !isPublicListingImageRoute) {
      send(response, Response.json({ error: "Route introuvable." }, { status: 404 }), origin, allowedOrigins);
      return;
    }

    if (request.method === "OPTIONS") {
      const result = origin && allowedOrigins.has(origin)
        ? new Response(null, { status: 204 })
        : Response.json({ error: "Origine de la demande non autorisée." }, { status: 403 });
      send(response, result, origin, allowedOrigins, corsMethods);
      return;
    }

    const allowedMethods = isAdminRoute ? ["GET", "POST", "PATCH", "PUT", "DELETE"] : isClientRoute ? ["GET", "POST", "DELETE"] : isPublicListingImageRoute ? ["GET"] : ["POST"];
    if (!request.method || !allowedMethods.includes(request.method)) {
      send(response, Response.json({ error: "Méthode non autorisée." }, { status: 405, headers: { Allow: `${allowedMethods.join(", ")}, OPTIONS` } }), origin, allowedOrigins, corsMethods);
      return;
    }

    const contentLength = Number(request.headers["content-length"] ?? 0);
    const isFileUpload = isAdminRoute &&
      ((requestPath === "/api/admin/files" || requestPath === "/api/admin/listing-images") && request.method === "POST");
    const maxBodyBytes = isFileUpload ? MAX_FILE_BODY_BYTES : isAdminRoute ? MAX_ADMIN_BODY_BYTES : MAX_BODY_BYTES;
    if (!Number.isFinite(contentLength) || contentLength > maxBodyBytes) {
      send(response, Response.json({ error: "La demande dépasse la taille autorisée." }, { status: 413 }), origin, allowedOrigins, corsMethods);
      return;
    }

    try {
      const body = await readBody(request, maxBodyBytes);
      if (body === null) {
        send(response, Response.json({ error: "La demande dépasse la taille autorisée." }, { status: 413 }), origin, allowedOrigins, corsMethods);
        return;
      }

      const webRequest = toWebRequest(request, body, isFileUpload);
      let result: Response;
      if (isAdminRoute) result = await handleAdminRequest(webRequest, allowedOrigins);
      else if (isClientRoute) result = await handleClientRequest(webRequest, allowedOrigins);
      else if (isPublicListingImageRoute) {
        const config = getConfig();
        result = config
          ? await handlePublicListingImage(webRequest, config, new URL(webRequest.url).pathname.split("/").filter(Boolean).slice(3))
          : jsonError("Le stockage des photos n’est pas configuré.", 503);
      } else result = await handleContactRequest(webRequest, allowedOrigins, requestPath === "/api/contact/visits");
      send(response, result, origin, allowedOrigins, corsMethods);
    } catch (error) {
      console.error("Sama Kër API request failed", error instanceof Error ? error.message : "unknown error");
      send(response, Response.json({ error: "Le service est momentanément indisponible." }, { status: 500 }), origin, allowedOrigins, corsMethods);
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be a valid TCP port.");
  }

  const server = createBackendServer();
  server.listen(port, host, () => {
    console.log(`Sama Kër API listening on ${host}:${port}`);
  });
}
