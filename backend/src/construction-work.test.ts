import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { handleAdminConstructionWork, handleClientConstructionWork } from "./construction-work";
import type { StaffIdentity } from "./staff";

const userId = "28e23e9e-38a3-4f92-aa05-743f28c3bd37";
const projectId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const originalFetch = globalThis.fetch;
const oldEnabled = process.env.CONSTRUCTION_WORK_ENABLED;
const config = {
  baseUrl: "https://supabase.example.test",
  serviceRoleKey: "synthetic-service-role-key",
  anonKey: "synthetic-anon-key",
  allowedEmails: ["admin@example.test"],
};
const manager: StaffIdentity = {
  id: "5f5a8a3e-6f0e-4a0b-9f6d-2b7d1d4a9c11",
  email: "worker@example.test",
  role: "responsable_travaux",
  source: "table",
  permissions: ["work:read", "work:write"],
  canReview: false,
};
let calls: { url: string; method: string; body: unknown }[] = [];

before(() => {
  process.env.CONSTRUCTION_WORK_ENABLED = "true";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const rawBody = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method, body: rawBody ? JSON.parse(rawBody) as unknown : undefined });
    if (url.includes("/rpc/confirmed_user_id_for_email")) return Response.json(userId);
    if (url.includes("/rest/v1/construction_work_projects") && method === "POST") {
      return Response.json([{ id: projectId }], { status: 201 });
    }
    if (url.includes("/rest/v1/construction_work_projects") && method === "GET") {
      return Response.json([{ id: projectId, title: "Maison", description: "", client_email: "client@example.test", assigned_to: manager.email }]);
    }
    if (url.includes("/rest/v1/construction_work_phases") && method === "GET") {
      return Response.json([{ project_id: projectId, phase_index: 0, title: "Préparation", status: "in_progress" }]);
    }
    if (url.includes("/rest/v1/construction_work_updates") && method === "GET") {
      return Response.json([{ id: projectId, project_id: projectId, phase_index: 0, body: "Avancement partagé", status: "published", published_at: "2026-11-12T10:00:00Z", created_by: manager.id }]);
    }
    if (url.includes("/rest/v1/construction_work_photos") && method === "GET") {
      return Response.json([]);
    }
    if (url.includes("/rest/v1/construction_work_phases") && method === "POST") {
      return new Response(null, { status: 201 });
    }
    if (url.includes("/rest/v1/construction_work_phases") && method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  };
});

beforeEach(() => { calls = []; });

after(() => {
  globalThis.fetch = originalFetch;
  if (oldEnabled === undefined) delete process.env.CONSTRUCTION_WORK_ENABLED;
  else process.env.CONSTRUCTION_WORK_ENABLED = oldEnabled;
});

function jsonRequest(path: string, method: string, body?: unknown) {
  return new Request(`https://backend.example.test${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}

test("creates a construction project only for an existing confirmed client and adds eight phases", async () => {
  const response = await handleAdminConstructionWork(
    jsonRequest("/api/admin/work/projects", "POST", { clientEmail: "CLIENT@example.test", title: "Maison familiale", description: "" }),
    config,
    ["projects"],
    manager,
  );
  assert.equal(response.status, 201);
  const created = calls.find((call) => call.url.includes("/rest/v1/construction_work_projects") && call.method === "POST");
  assert.deepEqual(created?.body, {
    client_user_id: userId,
    client_email: "client@example.test",
    assigned_to: manager.email,
    title: "Maison familiale",
    description: "",
    created_by: manager.id,
  });
  const phases = calls.find((call) => call.url.includes("/rest/v1/construction_work_phases") && call.method === "POST");
  assert.deepEqual((phases?.body as Array<{ phase_index: number }>).map((phase) => phase.phase_index), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("a construction manager cannot assign a new project to someone else", async () => {
  const response = await handleAdminConstructionWork(
    jsonRequest("/api/admin/work/projects", "POST", {
      clientEmail: "client@example.test", title: "Chantier", description: "", assignedTo: "another@example.test",
    }),
    config,
    ["projects"],
    manager,
  );
  assert.equal(response.status, 403);
  assert.equal(calls.some((call) => call.url.includes("confirmed_user_id_for_email")), false);
});

test("client construction lists are matched to the confirmed account and exclude drafts", async () => {
  const result = await handleClientConstructionWork({ id: userId, email: "client@example.test" }, ["construction"], config);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 200);
  const projectsQuery = calls.find((call) => call.url.includes("/rest/v1/construction_work_projects"));
  assert.ok(projectsQuery?.url.includes(`client_user_id=eq.${userId}`));
  assert.ok(projectsQuery?.url.includes("client_email=eq.client%40example.test"));
  const updatesQuery = calls.find((call) => call.url.includes("/rest/v1/construction_work_updates"));
  assert.ok(updatesQuery?.url.includes("status=eq.published"));
  const body = await result.json() as { projects: Array<{ updates: Array<{ status: string }> }> };
  assert.deepEqual(body.projects[0].updates.map((update) => update.status), ["published"]);
});
