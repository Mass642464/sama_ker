"use client";

import { getAccessToken } from "@/lib/client-api";

function apiOrigin() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("Le service n’est pas configuré.");
  const url = new URL(apiUrl);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((!isLocal && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Le service n’est pas configuré.");
  }
  return url.origin;
}

// Appel de l'espace client : seules les routes /api/client/ sont acceptées, avec la session vérifiée par l'API.
export async function clientApi<T = void>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!path.startsWith("/api/client/")) throw new Error("Route client invalide.");
  const token = await getAccessToken();
  if (!token) throw new Error("Votre session a expiré. Reconnectez-vous.");

  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Le service est injoignable pour le moment.");
  }
  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) throw new Error("Le service n’a pas pu répondre.");
    throw new Error("Le service a renvoyé une réponse invalide.");
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "L’opération a échoué.";
    throw new Error(message);
  }
  return payload as T;
}
