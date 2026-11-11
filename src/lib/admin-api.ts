"use client";

import type { Property, PropertyPhoto } from "@/lib/properties";
import { createClient } from "@/lib/supabase/browser";

export type AdminListing = Omit<Property, "photos"> & {
  id: string;
  locationLabel: string;
  publicationStatus: "draft" | "review" | "published" | "archived";
  pricePeriod: "total" | "monthly";
  reviewRevision: number | null;
  photos?: AdminListingPhoto[];
};

export type AdminListingPhoto = PropertyPhoto & { previewSrc?: string };

export type AdminLead = {
  id: string;
  full_name: string;
  email: string;
  interest: string;
  source: string;
  message: string;
  pipeline_stage: string;
  created_at: string;
  has_account: boolean;
  assigned_to: string | null;
};

export type AdminPermission =
  | "dashboard:read" | "properties:read" | "properties:write" | "properties:review"
  | "leads:read" | "leads:write" | "appointments:read" | "appointments:write" | "staff:manage" | "audit:read";

export type AdminSession = {
  email: string;
  role: string;
  roleLabel: string;
  permissions: AdminPermission[];
  canReview: boolean;
};

export type StaffMember = { email: string; role: string; active: boolean; managedByEnvironment: boolean };
export type StaffRoster = { roles: { role: string; label: string }[]; bootstrap: StaffMember[]; members: StaffMember[] };

export type AuditEntry = {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, string | number | boolean | null>;
};

export type LeadEvent = { id: string; at: string; actor: string; kind: "note" | "reply" | "stage" | "assignment" | "reminder"; body: string };
export type LeadReminder = { id: string; leadId: string; leadName: string; dueAt: string; note: string; assignedTo: string | null };

export type AdminAppointment = {
  id: string;
  contact_name: string;
  contact_email: string;
  purpose: string;
  starts_at: string;
  location: string;
  status: string;
  lead_id: string | null;
};

export type AdminDashboard = {
  listings: number;
  land: number;
  realEstate: number;
  published: number;
  leads: number;
  leadsToQualify: number;
  appointments: number;
};

export type ListingDraft = {
  ref: string;
  title: string;
  category: "terrain" | "immobilier";
  region: string;
  location: string;
  price: number;
  pricePeriod: "total" | "monthly";
  area: number;
  kind: string;
  status: string;
  description: string;
  features: string[];
  publicationStatus: string;
  latitude: number | null;
  longitude: number | null;
  photos: AdminListingPhoto[];
};

export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("Configurez NEXT_PUBLIC_API_URL pour connecter l’administration.");
  const url = new URL(apiUrl);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if ((!isLocal && url.protocol !== "https:") || url.username || url.password ||
    url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_API_URL doit utiliser HTTPS.");
  }
  const endpoint = new URL(path, `${url.origin}/`);
  if (endpoint.origin !== url.origin || !endpoint.pathname.startsWith("/api/admin/")) {
    throw new Error("La route d’administration demandée est invalide.");
  }

  const { data: { session }, error: sessionError } = await createClient().auth.getSession();
  if (sessionError) throw new Error("La session n’a pas pu être vérifiée.");
  if (!session?.access_token) throw new Error("Votre session a expiré. Reconnectez-vous.");

  const headers = new Headers(init.headers);
  if (init.body && !(typeof Blob !== "undefined" && init.body instanceof Blob) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${session.access_token}`);

  const response = await fetch(endpoint, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("La réponse du serveur est invalide.");
    throw error;
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string" ? payload.error : "L’opération a échoué.";
    if (response.status === 401) throw new Error("Votre session a expiré. Déconnectez-vous puis reconnectez-vous.");
    throw new Error(message);
  }
  return payload as T;
}
