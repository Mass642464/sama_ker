import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { handleAdminRequest } from "./admin-router";

const origin = "http://localhost:3000";
const accessToken = "synthetic-access-token";
const listingId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const listingRow = {
  id: listingId,
  slug: "annonce-test-ref-test",
  reference: "T-TEST-01",
  category: "terrain",
  title: "Annonce synthétique de test",
  region: "Thiès",
  location_label: "Zone générale de test",
  price_amount: "18500000",
  price_period: "total",
  area_m2: "300",
  property_type: "Terrain de test",
  availability_status: "Disponible",
  description: "Description synthétique réservée aux tests automatisés.",
  features: ["Donnée synthétique"],
  publication_status: "published",
  listing_review_state: { revision: 1 },
  property_listing_media: [{
    image_url: "https://example.com/illustration-test.jpg",
    alt_text: "Illustration synthétique réservée aux tests",
    credit: "Fichier de test",
    source_url: null,
  }],
};

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  emails: process.env.ADMIN_EMAILS,
  reviewers: process.env.LISTING_REVIEWER_EMAILS,
};
let authEmail = "admin@example.test";
let databaseCalls = 0;
let lastDatabaseRequest: { url: string; method: string; body: string | undefined } | null = null;

before(() => {
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  process.env.ADMIN_EMAILS = "admin@example.test";
  process.env.LISTING_REVIEWER_EMAILS = "admin@example.test";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) {
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${accessToken}`);
      return Response.json({ id: "28e23e9e-38a3-4f92-aa05-743f28c3bd37", email: authEmail, email_confirmed_at: "2026-11-09T09:00:00Z" });
    }
    if ((url.includes("/rest/v1/audit_log") || url.includes("/rest/v1/lead_events")) && (init?.method ?? "GET") === "POST") return new Response(null, { status: 201 });
    databaseCalls += 1;
    lastDatabaseRequest = {
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    if (url.includes("property_listings") && (init?.method ?? "GET") === "GET") {
      return Response.json([listingRow]);
    }
    if (url.includes("property_listings") && init?.method === "PATCH") return Response.json([{ id: listingId }]);
    if (url.includes("crm_leads") && (init?.method ?? "GET") === "GET") {
      return Response.json([
        { id: listingId, full_name: "Compte Test", email: "compte@example.test", interest: "Demande", source: "Site web", message: "", pipeline_stage: "Nouveau", created_at: "2026-11-09T09:00:00Z", user_id: "28e23e9e-38a3-4f92-aa05-743f28c3bd37" },
        { id: "0b0c3a52-1a2c-4a3d-8f5e-6d7a9c8b1e22", full_name: "Anonyme Test", email: "anonyme@example.test", interest: "Demande", source: "Site web", message: "", pipeline_stage: "Nouveau", created_at: "2026-11-09T09:00:00Z", user_id: null },
      ]);
    }
    if (url.includes("/rpc/")) return Response.json([{ id: listingId }]);
    return Response.json([{ id: listingId }], { status: 201 });
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    SUPABASE_URL: originalEnvironment.url,
    SUPABASE_ANON_KEY: originalEnvironment.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: originalEnvironment.serviceRoleKey,
    ADMIN_EMAILS: originalEnvironment.emails,
    LISTING_REVIEWER_EMAILS: originalEnvironment.reviewers,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function request(path: string, method = "GET", token?: string, body?: unknown) {
  return new Request(`https://backend.example.test${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("refuses admin data requests without a bearer session", async () => {
  const response = await handleAdminRequest(request("/api/admin/properties"), new Set([origin]));
  assert.equal(response.status, 401);
});

test("allows only emails explicitly configured for administration", async () => {
  authEmail = "other@example.test";
  const response = await handleAdminRequest(request("/api/admin/session", "GET", accessToken), new Set([origin]));
  assert.equal(response.status, 403);
  authEmail = "admin@example.test";
});

test("validates the session with Supabase before returning the admin identity", async () => {
  const response = await handleAdminRequest(request("/api/admin/session", "GET", accessToken), new Set([origin]));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    email: "admin@example.test", role: "admin", roleLabel: "Administrateur", canReview: true,
    permissions: ["dashboard:read", "properties:read", "properties:write", "leads:read", "leads:write", "appointments:read", "appointments:write", "staff:manage", "audit:read", "work:read", "work:write", "work:assign", "properties:review"],
  });
});

test("maps private listing rows to the admin view model", async () => {
  const response = await handleAdminRequest(request("/api/admin/properties", "GET", accessToken), new Set([origin]));
  assert.equal(response.status, 200);
  const [listing] = await response.json() as Array<Record<string, unknown>>;
  assert.equal(listing.ref, "T-TEST-01");
  assert.equal(listing.isDemo, false);
  assert.equal(listing.publicationStatus, "published");
  assert.match(String(listing.priceLabel), /18\s500\s000 FCFA/);
  assert.deepEqual(listing.photos, [{
    src: "https://example.com/illustration-test.jpg",
    alt: "Illustration synthétique réservée aux tests",
    credit: "Fichier de test",
    sourceUrl: "",
  }]);
});

test("rejects malformed property mutations before database access", async () => {
  const callsBefore = databaseCalls;
  const response = await handleAdminRequest(
    request("/api/admin/properties", "POST", accessToken, { title: "Annonce sans champs requis" }),
    new Set([origin]),
  );
  assert.equal(response.status, 400);
  assert.equal(databaseCalls, callsBefore);
});

test("saves listing fields and photos atomically through the database function", async () => {
  const listing = {
    ref: "T-TEST-02",
    title: "Annonce synthétique modifiable",
    category: "terrain",
    region: "Thiès",
    location: "Zone générale de test",
    price: 18_500_000,
    pricePeriod: "total",
    area: 300,
    kind: "Terrain de test",
    status: "Disponible",
    description: "Description synthétique réservée aux tests automatisés.",
    features: ["Donnée synthétique"],
    publicationStatus: "draft",
    photos: [{
      src: "https://example.com/illustration-test.jpg",
      alt: "Illustration synthétique réservée aux tests",
      credit: "Fichier de test",
      sourceUrl: "",
    }],
  };
  const callsBefore = databaseCalls;
  const directPublish = await handleAdminRequest(
    request("/api/admin/properties", "POST", accessToken, { ...listing, publicationStatus: "published" }),
    new Set([origin]),
  );
  assert.equal(directPublish.status, 403);
  assert.equal(databaseCalls, callsBefore);
  const created = await handleAdminRequest(
    request("/api/admin/properties", "POST", accessToken, listing),
    new Set([origin]),
  );
  assert.equal(created.status, 201);
  assert.equal(lastDatabaseRequest?.url.endsWith("/rpc/save_reviewable_listing"), true);
  assert.equal(lastDatabaseRequest?.method, "POST");
  const createBody = JSON.parse(lastDatabaseRequest?.body ?? "{}") as Record<string, unknown>;
  assert.equal(createBody.p_property_id, null);
  assert.equal(createBody.p_actor, "28e23e9e-38a3-4f92-aa05-743f28c3bd37");
  assert.equal((createBody.p_listing as Record<string, unknown>).reference, listing.ref);
  assert.deepEqual(createBody.p_photos, listing.photos);

  const updated = await handleAdminRequest(
    request(`/api/admin/properties/${listingId}`, "PATCH", accessToken, listing),
    new Set([origin]),
  );
  assert.equal(updated.status, 200);
  assert.equal(lastDatabaseRequest?.url.endsWith("/rpc/save_reviewable_listing"), true);
  assert.equal(JSON.parse(lastDatabaseRequest?.body ?? "{}").p_property_id, listingId);
});

test("stores only a rounded public location inside the Senegal bounds, both values or none", async () => {
  const base = {
    ref: "T-TEST-03", title: "Annonce synthétique localisée", category: "terrain", region: "Thiès", location: "Zone générale de test",
    price: 18_500_000, pricePeriod: "total", area: 300, kind: "Terrain de test", status: "Disponible",
    description: "Description synthétique réservée aux tests automatisés.", features: [], publicationStatus: "review",
    photos: [{ src: "https://example.com/illustration-test.jpg", alt: "Illustration synthétique réservée aux tests", credit: "Fichier de test", sourceUrl: "" }],
  };
  const send = (extra: Record<string, unknown>) => handleAdminRequest(request("/api/admin/properties", "POST", accessToken, { ...base, ...extra }), new Set([origin]));

  const accepted = await send({ latitude: 14.79123456, longitude: -16.92654321 });
  assert.equal(accepted.status, 201);
  const sent = JSON.parse(lastDatabaseRequest?.body ?? "{}").p_listing as Record<string, unknown>;
  assert.equal(sent.public_latitude, 14.79);
  assert.equal(sent.public_longitude, -16.93);

  const withoutLocation = await send({});
  assert.equal(withoutLocation.status, 201);
  const cleared = JSON.parse(lastDatabaseRequest?.body ?? "{}").p_listing as Record<string, unknown>;
  assert.equal(cleared.public_latitude, null);
  assert.equal(cleared.public_longitude, null);

  const callsBefore = databaseCalls;
  for (const invalid of [
    { latitude: 14.79 },
    { longitude: -16.93 },
    { latitude: 48.85, longitude: 2.35 },
    { latitude: "14.79", longitude: -16.93 },
    { latitude: Number.NaN, longitude: -16.93 },
  ]) {
    assert.equal((await send(invalid)).status, 400, JSON.stringify(invalid));
  }
  assert.equal(databaseCalls, callsBefore);
});

test("persists availability changes through the service API", async () => {
  const response = await handleAdminRequest(
    request(`/api/admin/properties/${listingId}`, "PATCH", accessToken, { availabilityStatus: "Réservé" }),
    new Set([origin]),
  );
  assert.equal(response.status, 200);
  assert.equal(lastDatabaseRequest?.method, "POST");
  assert.match(lastDatabaseRequest?.url ?? "", /change_reviewable_availability/);
  const body = JSON.parse(lastDatabaseRequest?.body ?? "{}") as Record<string, unknown>;
  assert.equal(body.p_status, "Réservé");
  assert.equal(body.p_actor, "28e23e9e-38a3-4f92-aa05-743f28c3bd37");
});

test("requires a designated reviewer and explicit checks before approval", async () => {
  const approval = { revision: 1, fieldsConfirmed: true, mediaConfirmed: true, publicContentConfirmed: true };
  process.env.LISTING_REVIEWER_EMAILS = "other@example.test";
  const callsBefore = databaseCalls;
  const denied = await handleAdminRequest(request(`/api/admin/properties/${listingId}/approve`, "POST", accessToken, approval), new Set([origin]));
  assert.equal(denied.status, 403);
  assert.equal(databaseCalls, callsBefore);
  process.env.LISTING_REVIEWER_EMAILS = "admin@example.test";
  const incomplete = await handleAdminRequest(request(`/api/admin/properties/${listingId}/approve`, "POST", accessToken, { ...approval, mediaConfirmed: false }), new Set([origin]));
  assert.equal(incomplete.status, 400);
  assert.equal(databaseCalls, callsBefore);
  const approved = await handleAdminRequest(request(`/api/admin/properties/${listingId}/approve`, "POST", accessToken, approval), new Set([origin]));
  assert.equal(approved.status, 200);
  assert.match(lastDatabaseRequest?.url ?? "", /approve_reviewable_listing/);
  assert.equal(JSON.parse(lastDatabaseRequest?.body ?? "{}").p_revision, 1);
});

test("lists CRM leads with an account indicator but never the account identifier", async () => {
  const response = await handleAdminRequest(request("/api/admin/leads", "GET", accessToken), new Set([origin]));
  assert.equal(response.status, 200);
  const leads = await response.json() as Array<Record<string, unknown>>;
  assert.deepEqual(leads.map((lead) => lead.has_account), [true, false]);
  assert.ok(leads.every((lead) => !("user_id" in lead)));
  assert.match(lastDatabaseRequest?.url ?? "", /select=[^&]*user_id/);
});

test("persists new CRM leads with the authenticated creator", async () => {
  const response = await handleAdminRequest(
    request("/api/admin/leads", "POST", accessToken, {
      fullName: "Contact de test",
      email: "contact@example.test",
      interest: "Demande synthétique",
      source: "Test automatisé",
    }),
    new Set([origin]),
  );
  assert.equal(response.status, 201);
  assert.equal(lastDatabaseRequest?.method, "POST");
  assert.match(lastDatabaseRequest?.url ?? "", /crm_leads/);
  const body = JSON.parse(lastDatabaseRequest?.body ?? "{}") as Record<string, unknown>;
  assert.equal(body.full_name, "Contact de test");
  assert.equal(body.pipeline_stage, undefined);
  assert.equal(body.created_by, "28e23e9e-38a3-4f92-aa05-743f28c3bd37");
});

test("persists appointments and validates requested calendar ranges", async () => {
  const invalidRange = await handleAdminRequest(
    request("/api/admin/appointments?from=invalid&to=invalid", "GET", accessToken),
    new Set([origin]),
  );
  assert.equal(invalidRange.status, 400);

  const response = await handleAdminRequest(
    request("/api/admin/appointments", "POST", accessToken, {
      contactName: "Contact de test",
      contactEmail: "contact@example.test",
      purpose: "Rendez-vous synthétique",
      startsAt: "2026-11-06T09:00:00.000Z",
      location: "Lieu de test",
    }),
    new Set([origin]),
  );
  assert.equal(response.status, 201);
  assert.equal(lastDatabaseRequest?.method, "POST");
  assert.match(lastDatabaseRequest?.url ?? "", /admin_appointments/);
  const body = JSON.parse(lastDatabaseRequest?.body ?? "{}") as Record<string, unknown>;
  assert.equal(body.contact_email, "contact@example.test");
  assert.equal(body.starts_at, "2026-11-06T09:00:00.000Z");
  assert.equal(body.created_by, "28e23e9e-38a3-4f92-aa05-743f28c3bd37");
});

test("persists CRM pipeline and appointment status changes", async () => {
  const lead = await handleAdminRequest(
    request("/api/admin/leads/92c82112-63d1-4ad2-8df9-320e7b5cf7dc", "PATCH", accessToken, { pipelineStage: "À qualifier" }),
    new Set([origin]),
  );
  assert.equal(lead.status, 200);
  assert.match(lastDatabaseRequest?.url ?? "", /crm_leads/);
  assert.equal(JSON.parse(lastDatabaseRequest?.body ?? "{}").pipeline_stage, "À qualifier");

  const appointment = await handleAdminRequest(
    request("/api/admin/appointments/92c82112-63d1-4ad2-8df9-320e7b5cf7dc", "PATCH", accessToken, { status: "Confirmé" }),
    new Set([origin]),
  );
  assert.equal(appointment.status, 200);
  assert.match(lastDatabaseRequest?.url ?? "", /admin_appointments/);
  assert.equal(JSON.parse(lastDatabaseRequest?.body ?? "{}").status, "Confirmé");
});
