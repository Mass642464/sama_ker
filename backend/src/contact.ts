import { createHmac } from "node:crypto";
import { getAuthConfig, verifyUser, type VerifiedUser } from "./user-auth";

const MAX_BODY_BYTES = 8_192;
const allowedSubjects = new Set(["property", "visit", "geospatial", "report", "other"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
  propertyReference: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  try {
    const url = new URL(supabaseUrl);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!isLocal && url.protocol !== "https:") || (isLocal && !["http:", "https:"].includes(url.protocol)) ||
      url.pathname !== "/" || url.search || url.hash) return null;
    return { baseUrl: url.origin, serviceRoleKey };
  } catch {
    return null;
  }
}

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

export function getAllowedOrigins() {
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  const origins = new Set<string>();

  for (const configuredOrigin of configuredOrigins) {
    const url = new URL(configuredOrigin);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!isLocal && url.protocol !== "https:") || (isLocal && !["http:", "https:"].includes(url.protocol)) ||
      url.origin !== configuredOrigin || url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`Invalid ALLOWED_ORIGINS entry: ${configuredOrigin}`);
    }
    origins.add(url.origin);
  }

  return origins;
}

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function handleContactRequest(request: Request, allowedOrigins = getAllowedOrigins()) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.has(origin)) {
    return jsonError("Origine de la demande non autorisée.", 403);
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonError("Format de demande invalide.", 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > MAX_BODY_BYTES) {
    return jsonError("La demande dépasse la taille autorisée.", 413);
  }

  const rawBody = await readBoundedBody(request);
  if (rawBody === null) {
    return jsonError("La demande dépasse la taille autorisée.", 413);
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonError("Le contenu envoyé n’est pas un JSON valide.", 400);
    throw error;
  }

  if (!isRecord(input)) return jsonError("Les champs de la demande sont invalides.", 400);
  if (typeof input.website === "string" && input.website.trim()) {
    return jsonError("La demande n’a pas été acceptée.", 400);
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const subject = typeof input.subject === "string" ? input.subject : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const propertyReference = typeof input.propertyReference === "string" ? input.propertyReference.trim() : "";
  if (input.propertyReference !== undefined && input.propertyReference !== null && typeof input.propertyReference !== "string") {
    return jsonError("La référence du bien est invalide.", 400);
  }

  if (name.length < 2 || name.length > 120) {
    return jsonError("Saisissez un nom compris entre 2 et 120 caractères.", 400);
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return jsonError("Saisissez une adresse e-mail valide.", 400);
  }
  if (!allowedSubjects.has(subject)) return jsonError("Choisissez un motif de demande valide.", 400);
  if (message.length < 10 || message.length > 4_000) {
    return jsonError("Le message doit contenir entre 10 et 4 000 caractères.", 400);
  }
  if (propertyReference.length > 80) {
    return jsonError("La référence du bien est trop longue.", 400);
  }
  if (input.consent !== true) return jsonError("Votre accord est requis pour traiter cette demande.", 400);

  if (process.env.CONTACT_FORM_ENABLED !== "true") {
    return jsonError("Le formulaire de contact n’est pas encore activé.", 503);
  }

  const config = getSupabaseConfig();
  if (!config) {
    return jsonError("La réception des demandes n’est pas configurée. Veuillez réessayer ultérieurement.", 503);
  }

  // Une session fournie doit être valide : on ne bascule jamais en silence vers une demande anonyme.
  let account: VerifiedUser | null = null;
  if (request.headers.has("authorization")) {
    const authConfig = getAuthConfig();
    if (!authConfig) return jsonError("L’espace client n’est pas configuré.", 503);
    const verified = await verifyUser(request, authConfig);
    if (verified instanceof Response) return verified;
    account = verified;
  }

  const payload: ContactPayload = {
    name,
    email: account?.email ?? email,
    subject,
    message,
    propertyReference: propertyReference || null,
  };
  const emailHash = createHmac("sha256", config.serviceRoleKey).update(payload.email).digest("hex");
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  let rateLimitResponse: Response;
  try {
    rateLimitResponse = await fetch(`${config.baseUrl}/rest/v1/rpc/consume_contact_request_rate_limit`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_email_hash: emailHash }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër contact rate-limit service unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("Le service de réception est momentanément indisponible.", 503);
  }

  if (!rateLimitResponse.ok) {
    console.error("Sama Kër contact rate-limit service returned", rateLimitResponse.status);
    return jsonError("Le service de réception est momentanément indisponible.", 503);
  }

  const rateLimitResult = await rateLimitResponse.text();
  if (rateLimitResult.trim() === "false") {
    return jsonError("Trop de demandes ont été envoyées avec cette adresse. Réessayez dans quelques minutes.", 429, {
      "Retry-After": "900",
    });
  }
  if (rateLimitResult.trim() !== "true") {
    console.error("Sama Kër contact rate-limit service returned an invalid response");
    return jsonError("Le service de réception est momentanément indisponible.", 503);
  }

  let insertResponse: Response;
  try {
    insertResponse = await fetch(`${config.baseUrl}/rest/v1/contact_requests`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        full_name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
        property_reference: payload.propertyReference,
        consented_at: new Date().toISOString(),
        ...(account ? { user_id: account.id } : {}),
      }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër contact storage unavailable", error instanceof Error ? error.message : "unknown error");
    return jsonError("La demande n’a pas pu être enregistrée. Veuillez réessayer ultérieurement.", 503);
  }

  if (!insertResponse.ok) {
    console.error("Sama Kër contact storage returned", insertResponse.status);
    return jsonError("La demande n’a pas pu être enregistrée. Veuillez réessayer ultérieurement.", 503);
  }

  return Response.json({ message: "Votre demande a bien été enregistrée." }, { status: 201 });
}
