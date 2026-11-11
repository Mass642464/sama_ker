"use client";

import { createClient } from "@/lib/supabase/browser";
import type { ClientRequest } from "@/lib/client-space";

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
