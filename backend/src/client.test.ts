import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { handleClientRequest } from "./client";
import { handleContactRequest } from "./contact";

const origin = "http://localhost:3000";
const allowedOrigins = new Set([origin]);
const accessToken = "synthetic-client-access-token-0001";
const userId = "28e23e9e-38a3-4f92-aa05-743f28c3bd37";
const leadId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";

const originalFetch = globalThis.fetch;
const savedEnvironment = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CONTACT_FORM_ENABLED"].map((key) => [key, process.env[key]]),
);

let confirmedAt: string | null = "2026-11-09T09:00:00Z";
let accountEmail = "client@example.test";
let authStatus = 200;
let databaseStatus = 200;
let leadRows: unknown[] = [];
let appointmentRows: unknown[] = [];
let calls: { url: string; method: string; body: string | undefined }[] = [];

before(() => {
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  process.env.CONTACT_FORM_ENABLED = "true";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : undefined });
    if (url.endsWith("/auth/v1/user")) {
      if (authStatus !== 200) return new Response("{}", { status: authStatus });
      return Response.json({ id: userId, email: accountEmail, email_confirmed_at: confirmedAt });
    }
    if (url.includes("/rpc/consume_contact_request_rate_limit")) return new Response("true");
    if (url.includes("/rest/v1/contact_requests")) return new Response(null, { status: 201 });
    if (databaseStatus !== 200) return new Response("{}", { status: databaseStatus });
    if (url.includes("/rest/v1/crm_leads")) return Response.json(leadRows);
    if (url.includes("/rest/v1/admin_appointments")) return Response.json(appointmentRows);
    return new Response("{}", { status: 404 });
  };
});

beforeEach(() => {
  confirmedAt = "2026-11-09T09:00:00Z";
  accountEmail = "client@example.test";
  authStatus = 200;
  databaseStatus = 200;
  leadRows = [];
  appointmentRows = [];
  calls = [];
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clientRequest(headers: Record<string, string> = {}, path = "/api/client/requests") {
  return new Request(`http://backend.local${path}`, { headers: { origin, ...headers } });
}

const bearer = { authorization: `Bearer ${accessToken}` };

test("client space refuses unauthenticated, foreign-origin and unconfirmed accounts", async () => {
  assert.equal((await handleClientRequest(clientRequest(), allowedOrigins)).status, 401);
  assert.equal((await handleClientRequest(new Request("http://backend.local/api/client/requests", { headers: { origin: "https://evil.example", ...bearer } }), allowedOrigins)).status, 403);

  confirmedAt = null;
  assert.equal((await handleClientRequest(clientRequest(bearer), allowedOrigins)).status, 403);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/")), false);

  confirmedAt = "2026-11-09T09:00:00Z";
  authStatus = 401;
  assert.equal((await handleClientRequest(clientRequest(bearer), allowedOrigins)).status, 401);
});

test("client space returns only the caller's requests with client-safe fields", async () => {
  leadRows = [
    {
      id: leadId, interest: "Demande de visite · Réf. T-1", message: "Bonjour", pipeline_stage: "Visite planifiée",
      created_at: "2026-11-09T09:00:00Z", updated_at: "2026-11-09T10:00:00Z", email: "interne@example.test", created_by: "secret",
    },
    { id: "0b0c3a52-1a2c-4a3d-8f5e-6d7a9c8b1e22", interest: "Autre", message: "", pipeline_stage: "Étape inconnue", created_at: "2026-11-08T09:00:00Z", updated_at: null },
  ];
  appointmentRows = [{ id: "5f5a8a3e-6f0e-4a0b-9f6d-2b7d1d4a9c11", lead_id: leadId, starts_at: "2026-11-12T09:00:00Z", status: "Confirmé", location: "Adresse interne", purpose: "Note interne" }];

  const response = await handleClientRequest(clientRequest(bearer), allowedOrigins);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const leadsCall = calls.find((call) => call.url.includes("/rest/v1/crm_leads"));
  assert.ok(leadsCall?.url.includes(`user_id=eq.${userId}`));
  assert.ok(!leadsCall?.url.includes("email") && !leadsCall?.url.includes("created_by"));
  assert.ok(calls.find((call) => call.url.includes("admin_appointments"))?.url.includes("lead_id=in.("));

  const body = await response.json() as { requests: Record<string, unknown>[] };
  assert.equal(body.requests.length, 2);
  assert.equal(body.requests[0].status, "visit_planned");
  assert.equal(body.requests[1].status, "received");
  assert.deepEqual(body.requests[0].appointments, [{ id: "5f5a8a3e-6f0e-4a0b-9f6d-2b7d1d4a9c11", startsAt: "2026-11-12T09:00:00Z", status: "Confirmé" }]);
  assert.ok(!JSON.stringify(body).match(/interne|secret/i));
});

test("client space skips the appointment query when the caller has no request", async () => {
  const response = await handleClientRequest(clientRequest(bearer), allowedOrigins);
  assert.deepEqual(await response.json(), { requests: [] });
  assert.equal(calls.some((call) => call.url.includes("admin_appointments")), false);
});

test("client space hides database failures and unknown routes", async () => {
  databaseStatus = 500;
  const failed = await handleClientRequest(clientRequest(bearer), allowedOrigins);
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("supabase"));

  assert.equal((await handleClientRequest(clientRequest(bearer, "/api/client/other"), allowedOrigins)).status, 404);
});

function contactRequest(headers: Record<string, string> = {}) {
  const body = JSON.stringify({
    name: "Client Test", email: "saisi@example.test", subject: "visit", message: "Je souhaite visiter ce bien.",
    propertyReference: "T-1", consent: true,
  });
  return new Request("http://backend.local/api/contact", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), ...headers },
    body,
  });
}

test("contact requests from a signed-in client are linked to the verified account", async () => {
  const response = await handleContactRequest(contactRequest(bearer), allowedOrigins);
  assert.equal(response.status, 201);
  const insert = calls.find((call) => call.url.endsWith("/rest/v1/contact_requests"));
  const stored = JSON.parse(insert?.body ?? "{}") as Record<string, unknown>;
  assert.equal(stored.user_id, userId);
  assert.equal(stored.email, "client@example.test");
});

test("anonymous contact requests carry no account link", async () => {
  const response = await handleContactRequest(contactRequest(), allowedOrigins);
  assert.equal(response.status, 201);
  const stored = JSON.parse(calls.find((call) => call.url.endsWith("/rest/v1/contact_requests"))?.body ?? "{}") as Record<string, unknown>;
  assert.equal("user_id" in stored, false);
  assert.equal(stored.email, "saisi@example.test");
});

test("an invalid or unconfirmed session is rejected instead of downgraded to anonymous", async () => {
  authStatus = 401;
  assert.equal((await handleContactRequest(contactRequest(bearer), allowedOrigins)).status, 401);
  authStatus = 200;
  confirmedAt = null;
  assert.equal((await handleContactRequest(contactRequest(bearer), allowedOrigins)).status, 403);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/contact_requests")), false);
});
