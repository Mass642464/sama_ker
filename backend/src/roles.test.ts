import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { handleAdminRequest } from "./admin-router";

const origin = "http://localhost:3000";
const allowed = new Set([origin]);
const leadId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const reminderId = "5f5a8a3e-6f0e-4a0b-9f6d-2b7d1d4a9c11";

const originalFetch = globalThis.fetch;
const savedEnvironment = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAILS", "LISTING_REVIEWER_EMAILS"].map((key) => [key, process.env[key]]),
);

// Annuaire de test : jeton -> adresse ; adresse -> rôle dans la table staff_members.
const tokens: Record<string, string> = {
  "token-admin-0000000000000": "boot@example.test",
  "token-commercial-00000000": "agent@example.test",
  "token-technique-000000000": "tech@example.test",
  "token-direction-000000000": "dir@example.test",
  "token-responsable-0000000": "resp@example.test",
  "token-inactif-00000000000": "inactif@example.test",
  "token-inconnu-00000000000": "inconnu@example.test",
};
const staffTable: Record<string, { role: string; active: boolean }> = {
  "agent@example.test": { role: "commercial", active: true },
  "tech@example.test": { role: "technique", active: true },
  "dir@example.test": { role: "direction", active: true },
  "resp@example.test": { role: "responsable", active: true },
  "inactif@example.test": { role: "commercial", active: false },
};

let calls: { url: string; method: string; body: Record<string, unknown> | null }[] = [];

before(() => {
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  process.env.ADMIN_EMAILS = "boot@example.test";
  delete process.env.LISTING_REVIEWER_EMAILS;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/auth/v1/user")) {
      const token = new Headers(init?.headers).get("authorization")?.replace("Bearer ", "") ?? "";
      const email = tokens[token];
      return email ? Response.json({ id: "28e23e9e-38a3-4f92-aa05-743f28c3bd37", email, email_confirmed_at: "2026-11-09T09:00:00Z" }) : new Response("{}", { status: 401 });
    }
    calls.push({ url, method, body: typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : null });
    if (url.includes("/rest/v1/staff_members") && method === "GET") {
      const email = decodeURIComponent(/email=eq\.([^&]+)/.exec(url)?.[1] ?? "");
      if (/role=in\./.test(url)) return Response.json(["admin", "commercial"].includes(staffTable[email]?.role ?? "") && staffTable[email].active ? [{ email }] : []);
      const row = staffTable[email];
      if (url.includes("email=eq.")) return Response.json(row?.active ? [{ role: row.role }] : []);
      return Response.json(Object.entries(staffTable).map(([mail, value]) => ({ email: mail, role: value.role, active: value.active, created_at: "2026-11-09T09:00:00Z" })));
    }
    if (url.includes("/rest/v1/crm_leads") && method === "GET") return Response.json(url.includes("id=eq.") ? [{ id: leadId }] : [{ id: leadId, full_name: "Prospect Test", email: "p@example.test", interest: "Demande", source: "Site web", message: "", pipeline_stage: "Nouveau", created_at: "2026-11-09T09:00:00Z", user_id: null, assigned_to: "agent@example.test" }]);
    if (url.includes("/rest/v1/lead_events") && method === "GET") return Response.json([{ id: "e1", at: "2026-11-09T09:00:00Z", actor_email: "agent@example.test", kind: "note", body: "Note interne" }]);
    if (url.includes("/rest/v1/lead_reminders") && method === "GET") return Response.json([{ id: reminderId, lead_id: leadId, due_at: "2026-11-10T09:00:00Z", note: "Rappeler", assigned_to: "agent@example.test" }]);
    if (url.includes("/rest/v1/audit_log") && method === "GET") return Response.json([{ id: 7, at: "2026-11-09T09:00:00Z", actor_email: "boot@example.test", action: "lead.stage", entity: "leads", entity_id: leadId, details: { pipelineStage: "À qualifier" } }]);
    if (method === "PATCH") return Response.json([{ id: leadId }]);
    if (method === "GET") return Response.json([]);
    return new Response(null, { status: 201 });
  };
});

beforeEach(() => { calls = []; });

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function send(token: string, path: string, method = "GET", body?: unknown) {
  return handleAdminRequest(new Request(`https://backend.example.test${path}`, {
    method,
    headers: { Origin: origin, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), allowed);
}

const as = (role: "admin" | "commercial" | "technique" | "direction" | "responsable") => ({
  admin: "token-admin-0000000000000", commercial: "token-commercial-00000000", technique: "token-technique-000000000",
  direction: "token-direction-000000000", responsable: "token-responsable-0000000",
})[role];

test("refuses accounts that are unknown, deactivated or unconfirmed", async () => {
  assert.equal((await send("token-inconnu-00000000000", "/api/admin/session")).status, 403);
  assert.equal((await send("token-inactif-00000000000", "/api/admin/session")).status, 403);
});

test("the session reports the role and permissions resolved on the server", async () => {
  const commercial = await (await send(as("commercial"), "/api/admin/session")).json() as Record<string, unknown>;
  assert.equal(commercial.role, "commercial");
  assert.deepEqual(commercial.permissions, ["dashboard:read", "properties:read", "leads:read", "leads:write", "appointments:read", "appointments:write"]);
  assert.equal(commercial.canReview, false);
  const reviewer = await (await send(as("responsable"), "/api/admin/session")).json() as Record<string, unknown>;
  assert.equal(reviewer.canReview, true);
  const bootstrap = await (await send(as("admin"), "/api/admin/session")).json() as Record<string, unknown>;
  assert.equal(bootstrap.role, "admin");
  assert.equal(bootstrap.canReview, false);
});

test("enforces the permission matrix per role", async () => {
  const property = "/api/admin/properties/" + leadId;
  const cases: [string, string, string, number][] = [
    ["commercial", "/api/admin/leads", "GET", 200],
    ["commercial", "/api/admin/properties", "GET", 200],
    ["commercial", property, "PATCH", 403],
    ["commercial", "/api/admin/staff", "GET", 403],
    ["commercial", "/api/admin/audit", "GET", 403],
    ["technique", "/api/admin/leads", "GET", 403],
    ["technique", "/api/admin/appointments?from=2026-11-01&to=2026-12-01", "GET", 403],
    ["technique", "/api/admin/properties", "GET", 200],
    ["direction", "/api/admin/leads", "GET", 200],
    ["direction", "/api/admin/leads/" + leadId, "PATCH", 403],
    ["direction", "/api/admin/appointments", "POST", 403],
    ["direction", "/api/admin/audit", "GET", 200],
    ["responsable", "/api/admin/staff", "GET", 403],
    ["responsable", `${property}/approve`, "POST", 400],
    ["admin", `${property}/approve`, "POST", 403],
    ["admin", "/api/admin/staff", "GET", 200],
  ];
  for (const [role, path, method, expected] of cases) {
    const body = method === "GET" ? undefined : {};
    const response = await send(as(role as "admin"), path, method, body);
    assert.equal(response.status, expected, `${role} ${method} ${path}`);
  }
});

test("lists leads with their assignee and records stage changes in the lead history", async () => {
  const leads = await (await send(as("commercial"), "/api/admin/leads")).json() as Array<Record<string, unknown>>;
  assert.equal(leads[0].assigned_to, "agent@example.test");

  const response = await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { pipelineStage: "À qualifier" });
  assert.equal(response.status, 200);
  const event = calls.find((call) => call.url.endsWith("/rest/v1/lead_events") && call.method === "POST");
  assert.deepEqual(event?.body, { lead_id: leadId, actor_email: "agent@example.test", kind: "stage", body: "Étape : À qualifier" });
});

test("assigns a lead only to an active administrator or sales agent", async () => {
  const ok = await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { assignedTo: "agent@example.test" });
  assert.equal(ok.status, 200);
  assert.equal(calls.find((call) => call.method === "PATCH")?.body?.assigned_to, "agent@example.test");

  for (const refused of ["tech@example.test", "inactif@example.test", "inconnu@example.test"]) {
    assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { assignedTo: refused })).status, 400, refused);
  }
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { assignedTo: null })).status, 200);
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { assignedTo: "pas-une-adresse" })).status, 400);
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { assignedTo: null, pipelineStage: "Fermé" })).status, 400);
});

test("keeps an exchange history with notes and reply records", async () => {
  const history = await (await send(as("direction"), `/api/admin/leads/${leadId}/events`)).json() as Array<Record<string, unknown>>;
  assert.deepEqual(history[0], { id: "e1", at: "2026-11-09T09:00:00Z", actor: "agent@example.test", kind: "note", body: "Note interne" });

  assert.equal((await send(as("direction"), `/api/admin/leads/${leadId}/events`, "POST", { kind: "note", body: "x" })).status, 403);
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}/events`, "POST", { kind: "note", body: "Rappelé, intéressé par une visite." })).status, 201);
  assert.equal(calls.find((call) => call.url.endsWith("/rest/v1/lead_events") && call.method === "POST")?.body?.kind, "note");
  for (const invalid of [{ kind: "stage", body: "x" }, { kind: "note", body: "" }, { kind: "note", body: "x".repeat(2001) }, { kind: "note", body: "ok", extra: 1 }]) {
    assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}/events`, "POST", invalid)).status, 400);
  }
});

test("schedules and completes follow-up reminders", async () => {
  const dueAt = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}/reminders`, "POST", { dueAt, note: "Rappeler le client" })).status, 201);
  const reminder = calls.find((call) => call.url.endsWith("/rest/v1/lead_reminders") && call.method === "POST");
  assert.equal(reminder?.body?.assigned_to, "agent@example.test");
  assert.equal(reminder?.body?.lead_id, leadId);

  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}/reminders`, "POST", { dueAt: "n'importe quoi" })).status, 400);
  const inTenMonths = new Date(Date.now() + 300 * 24 * 3600 * 1000).toISOString();
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}/reminders`, "POST", { dueAt: inTenMonths })).status, 201);
  assert.equal((await send(as("commercial"), `/api/admin/leads/${leadId}/reminders`, "POST", { dueAt: "2099-01-01T00:00:00Z" })).status, 400);

  const open = await (await send(as("commercial"), "/api/admin/reminders")).json() as Array<Record<string, unknown>>;
  assert.deepEqual(open[0], { id: reminderId, leadId, leadName: "Prospect Test", dueAt: "2026-11-10T09:00:00Z", note: "Rappeler", assignedTo: "agent@example.test" });
  assert.equal((await send(as("commercial"), `/api/admin/reminders/${reminderId}`, "PATCH", { done: true })).status, 200);
  assert.equal((await send(as("commercial"), `/api/admin/reminders/${reminderId}`, "PATCH", { done: false })).status, 400);
});

test("only administrators manage the team, never their own access or bootstrap accounts", async () => {
  const roster = await (await send(as("admin"), "/api/admin/staff")).json() as Record<string, unknown>;
  assert.deepEqual(roster.bootstrap, [{ email: "boot@example.test", role: "admin", active: true, managedByEnvironment: true }]);
  assert.equal((roster.members as unknown[]).length, 5);

  assert.equal((await send(as("admin"), "/api/admin/staff", "PUT", { email: "Nouveau@Example.test", role: "commercial", active: true })).status, 200);
  const saved = calls.find((call) => call.url.includes("/rest/v1/staff_members?on_conflict=email") && call.method === "POST");
  assert.equal(saved?.body?.email, "nouveau@example.test");
  assert.equal(saved?.body?.role, "commercial");

  assert.equal((await send(as("admin"), "/api/admin/staff", "PUT", { email: "boot@example.test", role: "direction", active: true })).status, 400);
  for (const invalid of [{ email: "x@example.test", role: "super-admin", active: true }, { email: "pas-un-mail", role: "commercial", active: true }, { email: "x@example.test", role: "commercial" }]) {
    assert.equal((await send(as("admin"), "/api/admin/staff", "PUT", invalid)).status, 400);
  }
  assert.equal((await send(as("commercial"), "/api/admin/staff", "PUT", { email: "x@example.test", role: "admin", active: true })).status, 403);
});

test("records mutations in the audit log without message content", async () => {
  await send(as("commercial"), `/api/admin/leads/${leadId}/events`, "POST", { kind: "note", body: "Contenu confidentiel du message" });
  const audit = calls.find((call) => call.url.endsWith("/rest/v1/audit_log") && call.method === "POST");
  assert.equal(audit?.body?.actor_email, "agent@example.test");
  assert.equal(audit?.body?.action, "lead.note");
  assert.equal(audit?.body?.entity_id, leadId);
  assert.ok(!JSON.stringify(audit?.body).includes("confidentiel"));

  calls = [];
  await send(as("commercial"), `/api/admin/leads/${leadId}`, "PATCH", { pipelineStage: "Fermé" });
  const stage = calls.find((call) => call.url.endsWith("/rest/v1/audit_log"));
  assert.equal(stage?.body?.action, "lead.stage");
  assert.deepEqual(stage?.body?.details, { pipelineStage: "Fermé" });

  calls = [];
  await send(as("commercial"), "/api/admin/leads", "GET");
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/audit_log")), false);
  await send(as("technique"), `/api/admin/leads/${leadId}`, "PATCH", { pipelineStage: "Fermé" });
  assert.equal(calls.some((call) => call.url.endsWith("/rest/v1/audit_log")), false);
});

test("exposes the audit log to administrators and management only", async () => {
  const log = await (await send(as("direction"), "/api/admin/audit?limit=5")).json() as Array<Record<string, unknown>>;
  assert.deepEqual(log[0], { id: 7, at: "2026-11-09T09:00:00Z", actor: "boot@example.test", action: "lead.stage", entity: "leads", entityId: leadId, details: { pipelineStage: "À qualifier" } });
  assert.match(calls.at(-1)?.url ?? "", /limit=5/);
  assert.equal((await send(as("admin"), "/api/admin/audit?before=abc")).status, 400);
  assert.equal((await send(as("technique"), "/api/admin/audit")).status, 403);
});
