import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { handleClientRequest } from "./client";

const origin = "http://localhost:3000";
const allowed = new Set([origin]);
const token = "synthetic-client-extras-token-01";
const userId = "28e23e9e-38a3-4f92-aa05-743f28c3bd37";
const alertId = "5f5a8a3e-6f0e-4a0b-9f6d-2b7d1d4a9c11";

const originalFetch = globalThis.fetch;
const savedEnvironment = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map((key) => [key, process.env[key]]),
);

let publishedSlugs = new Set<string>(["terrain-thies"]);
let favoritesCount = 0;
let alertsCount = 0;
let erasureStatus = 200;
let authDeleteStatus = 200;
let calls: { url: string; method: string; body: unknown }[] = [];

before(() => {
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : undefined;
    calls.push({ url, method, body });
    if (url.endsWith("/auth/v1/user")) {
      return Response.json({ id: userId, email: "client@example.test", email_confirmed_at: "2026-11-09T09:00:00Z" });
    }
    if (url.includes("/auth/v1/admin/users/")) return new Response(null, { status: authDeleteStatus });
    if (url.includes("/rpc/erase_client_account")) return erasureStatus === 200 ? Response.json(1) : new Response("{}", { status: erasureStatus });
    if (url.includes("/rest/v1/property_listings")) {
      const slug = /slug=eq\.([^&]+)/.exec(url)?.[1] ?? "";
      return Response.json(publishedSlugs.has(slug) ? [{ slug }] : []);
    }
    if (url.includes("/rest/v1/client_favorites") && method === "GET") {
      return Response.json(Array.from({ length: favoritesCount }, (_, index) => ({ property_slug: `bien-${index}`, created_at: "2026-11-09T09:00:00Z" })));
    }
    if (url.includes("/rest/v1/client_alerts") && method === "GET") {
      return Response.json(Array.from({ length: alertsCount }, () => ({ id: alertId, criteria: { category: "terrain" }, created_at: "2026-11-09T09:00:00Z" })));
    }
    if (url.includes("/rest/v1/client_alerts") && method === "POST") return Response.json(alertsCount);
    if (url.includes("/rest/v1/client_notifications") && method === "GET") {
      return Response.json([{ id: "n1", title: "Votre demande a changé d’étape", body: "Visite planifiée.", created_at: "2026-11-09T09:00:00Z", read_at: null }]);
    }
    if (url.includes("/rest/v1/client_favorites") && method === "POST") return new Response(null, { status: 201 });
    if (url.includes("/rest/v1/client_favorites") && method === "DELETE") return new Response(null, { status: 204 });
    if (url.includes("/rest/v1/client_alerts") && method === "DELETE") return new Response(null, { status: 204 });
    if (url.includes("/rest/v1/client_notifications") && method === "PATCH") return new Response(null, { status: 204 });
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
});

beforeEach(() => {
  publishedSlugs = new Set(["terrain-thies"]);
  favoritesCount = 0;
  alertsCount = 0;
  erasureStatus = 200;
  authDeleteStatus = 200;
  calls = [];
});

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function send(path: string, method = "GET", body?: unknown) {
  return handleClientRequest(new Request(`http://backend.local${path}`, {
    method,
    headers: { origin, authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), allowed);
}

test("favorites can only be added for published listings and stay scoped to the caller", async () => {
  const ok = await send("/api/client/favorites", "POST", { slug: "terrain-thies" });
  assert.equal(ok.status, 201);
  const insert = calls.find((call) => call.url.includes("/rest/v1/client_favorites") && call.method === "POST");
  assert.deepEqual(insert?.body, { user_id: userId, property_slug: "terrain-thies" });

  assert.equal((await send("/api/client/favorites", "POST", { slug: "brouillon-non-publie" })).status, 404);
  assert.equal((await send("/api/client/favorites", "POST", { slug: "../../etc" })).status, 400);
  assert.equal((await send("/api/client/favorites", "POST", { slug: "terrain-thies", extra: 1 })).status, 400);

  favoritesCount = 50;
  assert.equal((await send("/api/client/favorites", "POST", { slug: "terrain-thies" })).status, 400);
});

test("favorites list and removal return only the caller's slugs", async () => {
  favoritesCount = 2;
  const list = await (await send("/api/client/favorites")).json() as { favorites: string[] };
  assert.deepEqual(list.favorites, ["bien-0", "bien-1"]);
  const removed = await send("/api/client/favorites/terrain-thies", "DELETE");
  assert.equal(removed.status, 204);
  assert.match(calls.at(-1)?.url ?? "", new RegExp(`user_id=eq.${userId}`));
  assert.equal((await send("/api/client/favorites/Mauvais_Slug", "DELETE")).status, 400);
});

test("alerts accept only known criteria with valid values", async () => {
  assert.equal((await send("/api/client/alerts", "POST", { criteria: { category: "terrain", region: "Thiès", prixMax: 20_000_000 } })).status, 201);
  const stored = calls.find((call) => call.url.includes("/rest/v1/client_alerts") && call.method === "POST");
  assert.deepEqual(stored?.body, { user_id: userId, criteria: { category: "terrain", region: "Thiès", prixMax: 20_000_000 } });

  const invalid: unknown[] = [
    { criteria: {} },
    { criteria: { category: "voiture" } },
    { criteria: { prixMax: -1 } },
    { criteria: { prixMax: 1.5 } },
    { criteria: { surfaceMin: "400" } },
    { criteria: { user_id: userId } },
    { criteria: { region: "T" } },
    { criteria: { category: "terrain" }, extra: true },
  ];
  for (const body of invalid) assert.equal((await send("/api/client/alerts", "POST", body)).status, 400, JSON.stringify(body));

  alertsCount = 10;
  assert.equal((await send("/api/client/alerts", "POST", { criteria: { category: "terrain" } })).status, 400);
});

test("alerts are listed with an explicit note that sending is not active", async () => {
  alertsCount = 1;
  const body = await (await send("/api/client/alerts")).json() as { alerts: unknown[]; sending: boolean };
  assert.equal(body.sending, false);
  assert.equal(body.alerts.length, 1);
  assert.equal((await send(`/api/client/alerts/${alertId}`, "DELETE")).status, 204);
  assert.equal((await send("/api/client/alerts/pas-un-id", "DELETE")).status, 400);
});

test("notifications are listed for the caller and can be marked as read", async () => {
  const body = await (await send("/api/client/notifications")).json() as { notifications: Array<{ read: boolean }> };
  assert.equal(body.notifications[0].read, false);
  assert.equal((await send("/api/client/notifications/read", "POST")).status, 204);
  assert.match(calls.at(-1)?.url ?? "", new RegExp(`user_id=eq.${userId}`));
});

test("account deletion erases application data first, then the authentication account", async () => {
  const response = await send("/api/client/account", "DELETE");
  assert.equal(response.status, 200);
  const order = calls.map((call) => call.url.includes("erase_client_account") ? "erase" : call.url.includes("/auth/v1/admin/users/") ? "auth" : "");
  assert.deepEqual(order.filter(Boolean), ["erase", "auth"]);
  const erase = calls.find((call) => call.url.includes("erase_client_account"));
  assert.deepEqual(erase?.body, { p_user: userId });
});

test("a failed authentication deletion is reported without hiding the erasure", async () => {
  authDeleteStatus = 500;
  const response = await send("/api/client/account", "DELETE");
  assert.equal(response.status, 503);
  const message = (await response.json() as { error: string }).error;
  assert.match(message, /effacées/);
  assert.ok(!message.includes("supabase"));
});

test("account deletion stops before touching the auth account when erasure fails", async () => {
  erasureStatus = 500;
  assert.equal((await send("/api/client/account", "DELETE")).status, 503);
  assert.equal(calls.some((call) => call.url.includes("/auth/v1/admin/users/")), false);
});

test("unknown client sub-routes and methods are refused", async () => {
  assert.equal((await send("/api/client/inconnu")).status, 404);
  assert.equal((await send("/api/client/account", "GET")).status, 404);
});
