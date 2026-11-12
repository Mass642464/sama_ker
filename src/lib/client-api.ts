"use client";

import { createClient } from "@/lib/supabase/browser";
import type { ClientRequest } from "@/lib/client-space";
import type { VisitAction, VisitWorkflow } from "@/lib/visits";

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

export async function clientApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Votre session a expiré. Reconnectez-vous.");
  const url = new URL(path, `${apiOrigin()}/`);
  if (url.origin !== new URL(apiOrigin()).origin || !url.pathname.startsWith("/api/client/")) {
    throw new Error("La route de l’espace client demandée est invalide.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(typeof Blob !== "undefined" && init.body instanceof Blob) && typeof init.body !== "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new Error("Le service est injoignable pour le moment.");
  }
  if (response.status === 204) return undefined as T;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (reason) {
    if (reason instanceof SyntaxError) throw new Error("Le service a renvoyé une réponse invalide.");
    throw reason;
  }
  if (!response.ok) {
    const body = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
    throw new Error(typeof body.error === "string" ? body.error : "L’opération n’a pas pu être terminée.");
  }
  return payload as T;
}

export async function getAccessToken() {
  const { data: { session }, error } = await createClient().auth.getSession();
  if (error) throw new Error("Votre session n’a pas pu être vérifiée.");
  return session?.access_token ?? null;
}

export async function fetchClientRequests(): Promise<ClientRequest[]> {
  const token = await getAccessToken();
  if (!token) throw new Error("Votre session a expiré. Reconnectez-vous.");

  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api/client/requests`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    throw new Error("Le service est injoignable pour le moment.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Le service a renvoyé une réponse invalide.");
  }
  const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof record.error === "string" ? record.error : "Vos demandes n’ont pas pu être chargées.");
  if (!Array.isArray(record.requests)) throw new Error("Le service a renvoyé une réponse invalide.");
  return record.requests as ClientRequest[];
}

export async function clientVisits(id?: string, action?: VisitAction, revision?: number, proposedAt?: string, offset = 0): Promise<{ visits: VisitWorkflow[]; hasMore: boolean }> {
  const token = await getAccessToken();
  if (!token) throw new Error("Votre session a expiré. Reconnectez-vous.");
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api/client/visits${id ? `/${encodeURIComponent(id)}` : `?offset=${offset}`}`, {
      method: id ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(id ? { "Content-Type": "application/json" } : {}) },
      ...(id ? { body: JSON.stringify({ action, revision, ...(proposedAt ? { proposedAt } : {}) }) } : {}),
      cache: "no-store",
    });
  } catch {
    throw new Error("Le service des visites est injoignable.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Le service des visites a renvoyé une réponse invalide.");
  }
  if (typeof body !== "object" || body === null) throw new Error("Le service des visites a renvoyé une réponse invalide.");
  if (!response.ok) throw new Error("error" in body && typeof body.error === "string" ? body.error : "L’action n’a pas pu être enregistrée.");
  if (!id && (!("visits" in body) || !Array.isArray(body.visits) || !("hasMore" in body) || typeof body.hasMore !== "boolean")) throw new Error("Le service des visites a renvoyé une réponse invalide.");
  return !id && "visits" in body && Array.isArray(body.visits) && "hasMore" in body && typeof body.hasMore === "boolean"
    ? { visits: body.visits as VisitWorkflow[], hasMore: body.hasMore } : { visits: [], hasMore: false };
}
