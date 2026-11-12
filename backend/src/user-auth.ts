export type VerifiedUser = { id: string; email: string };

export type AuthConfig = { baseUrl: string; anonKey: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getAuthConfig(): AuthConfig | null {
  const rawUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!rawUrl || !anonKey) return null;

  try {
    const url = new URL(rawUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!local && url.protocol !== "https:") || url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return { baseUrl: url.origin, anonKey };
  } catch {
    return null;
  }
}

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(authorization);
  return match ? match[1] : null;
}

// Call only after verifyUser has validated the token with Supabase Auth.
export function hasRecentPasswordAuthentication(request: Request, now = Date.now()) {
  const token = readBearerToken(request);
  if (!token) return false;
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) return false;

  try {
    const payload: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!isRecord(payload) || typeof payload.auth_time !== "number" || !Array.isArray(payload.amr)) return false;
    const age = Math.floor(now / 1000) - payload.auth_time;
    const usedPassword = payload.amr.some((entry) => isRecord(entry) && entry.method === "password");
    return usedPassword && age >= 0 && age <= 30 * 60;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) return false;
    throw error;
  }
}

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

// Valide le jeton auprès de Supabase Auth ; seules les adresses confirmées sont acceptées.
export async function verifyUser(request: Request, config: AuthConfig): Promise<VerifiedUser | Response> {
  const token = readBearerToken(request);
  if (!token) return errorResponse("Connexion requise.", 401);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Sama Kër client auth unavailable", error instanceof Error ? error.message : "unknown error");
    return errorResponse("Le service d’authentification est indisponible.", 503);
  }
  if (response.status === 401 || response.status === 403) return errorResponse("Session invalide ou expirée.", 401);
  if (!response.ok) {
    console.error("Sama Kër client auth returned", response.status);
    return errorResponse("Le service d’authentification est indisponible.", 503);
  }

  const user: unknown = await response.json();
  if (!isRecord(user) || typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id) || typeof user.email !== "string") {
    return errorResponse("La session n’a pas pu être vérifiée.", 401);
  }
  if (typeof user.email_confirmed_at !== "string" || !user.email_confirmed_at) {
    return errorResponse("Confirmez votre adresse e-mail pour accéder à votre espace.", 403);
  }
  return { id: user.id, email: user.email.trim().toLowerCase() };
}
