import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { handleAdminRequest } from "./admin-router";
import { maxFileBytes } from "./files";

const origin = "http://localhost:3000";
const allowed = new Set([origin]);
const listingId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const fileId = "5f5a8a3e-6f0e-4a0b-9f6d-2b7d1d4a9c11";
const baseUrl = "https://supabase.example.test";

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

const originalFetch = globalThis.fetch;
const savedEnvironment = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAILS", "LISTING_REVIEWER_EMAILS"].map((key) => [key, process.env[key]]),
);

const tokens: Record<string, string> = {
  "token-admin-0000000000000": "boot@example.test",
  "token-technique-000000000": "tech@example.test",
  "token-commercial-00000000": "agent@example.test",
  "token-direction-000000000": "dir@example.test",
  "token-responsable-0000000": "resp@example.test",
};
const staffTable: Record<string, string> = {
  "tech@example.test": "technique",
  "agent@example.test": "commercial",
  "dir@example.test": "direction",
  "resp@example.test": "responsable",
};

let storageUpload = 200;
let storageSign = 200;
let storageDelete = 200;
let metadataInsert = 201;
let knownListing = true;
let calls: { url: string; method: string; headers: Headers; body: unknown }[] = [];

function reset() {
  storageUpload = 200;
  storageSign = 200;
  storageDelete = 200;
  metadataInsert = 201;
  knownListing = true;
  calls = [];
}

before(() => {
  process.env.SUPABASE_URL = baseUrl;
  process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  process.env.ADMIN_EMAILS = "boot@example.test";
  delete process.env.LISTING_REVIEWER_EMAILS;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) as unknown : rawBody instanceof Uint8Array ? rawBody : undefined;
    calls.push({ url, method, headers, body });

    if (url.endsWith("/auth/v1/user")) {
      const email = tokens[headers.get("authorization")?.replace("Bearer ", "") ?? ""];
      return email ? Response.json({ id: "28e23e9e-38a3-4f92-aa05-743f28c3bd37", email, email_confirmed_at: "2026-11-09T09:00:00Z" }) : new Response("{}", { status: 401 });
    }
    if (url.includes("/storage/v1/object/private-files/") && method === "POST") return new Response(JSON.stringify({ Key: "private-files/x" }), { status: storageUpload });
    if (url.includes("/storage/v1/object/sign/private-files/")) {
      return Response.json({ signedURL: `/object/sign/private-files/${url.split("/private-files/")[1]}?token=synthetic-token` }, { status: storageSign });
    }
    if (url.endsWith("/storage/v1/object/private-files") && method === "DELETE") return new Response("{}", { status: storageDelete });
    if (url.includes("/rest/v1/staff_members")) {
      const email = decodeURIComponent(/email=eq\.([^&]+)/.exec(url)?.[1] ?? "");
      const role = staffTable[email];
      return Response.json(role ? [{ role }] : []);
    }
    if (url.includes("/rest/v1/property_listings")) return Response.json(knownListing ? [{ id: listingId }] : []);
    if (url.includes("/rest/v1/audit_log")) return new Response(null, { status: 201 });
    if (url.includes("/rest/v1/listing_files")) {
      if (method === "POST") return metadataInsert === 201 ? Response.json([{ id: fileId }], { status: 201 }) : new Response("{}", { status: metadataInsert });
      if (method === "DELETE") return new Response(null, { status: 204 });
      if (url.includes("?id=eq.") || url.includes("&id=eq.")) return Response.json([{ object_path: `listing/${listingId}/${fileId}.pdf` }]);
      return Response.json([{ id: fileId, original_name: "bilan.pdf", mime_type: "application/pdf", size_bytes: 12, created_at: "2026-11-09T09:00:00Z" }]);
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  };
});

beforeEach(reset);

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function upload(token: string, bytes: Uint8Array, options: { type?: string; propertyId?: string; name?: string } = {}) {
  const params = new URLSearchParams({ propertyId: options.propertyId ?? listingId, name: options.name ?? "bilan.pdf" });
  return handleAdminRequest(new Request(`https://backend.example.test/api/admin/files?${params}`, {
    method: "POST",
    headers: { Origin: origin, Authorization: `Bearer ${token}`, "Content-Type": options.type ?? "application/pdf", "Content-Length": String(bytes.length) },
    body: bytes as unknown as BodyInit,
  }), allowed);
}

function send(token: string, path: string, method = "GET") {
  return handleAdminRequest(new Request(`https://backend.example.test${path}`, {
    method, headers: { Origin: origin, Authorization: `Bearer ${token}` },
  }), allowed);
}

const admin = "token-admin-0000000000000";
const technique = "token-technique-000000000";
const commercial = "token-commercial-00000000";
const direction = "token-direction-000000000";
const reviewer = "token-responsable-0000000";

test("stores a checked PDF privately under the listing and records metadata only", async () => {
  const response = await upload(technique, pdf);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: fileId });
  const stored = calls.find((call) => call.url.includes("/storage/v1/object/private-files/"));
  assert.match(stored?.url ?? "", new RegExp(`/private-files/listing/${listingId}/[0-9a-f-]{36}\\.pdf$`));
  assert.equal(stored?.headers.get("x-upsert"), "false");
  assert.equal(stored?.headers.get("content-type"), "application/pdf");
  const row = calls.find((call) => call.url.includes("/rest/v1/listing_files") && call.method === "POST")?.body as Record<string, unknown>;
  assert.equal(row.size_bytes, pdf.length);
  assert.equal(row.mime_type, "application/pdf");
  assert.equal(row.original_name, "bilan.pdf");
});

test("accepts JPEG and PNG and refuses any content that does not match the announced type", async () => {
  assert.equal((await upload(technique, jpeg, { type: "image/jpeg", name: "toit.jpg" })).status, 201);
  assert.equal((await upload(technique, png, { type: "image/png", name: "plan.png" })).status, 201);
  reset();
  assert.equal((await upload(technique, jpeg, { type: "application/pdf" })).status, 400);
  assert.equal((await upload(technique, pdf, { type: "image/png" })).status, 400);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/private-files/")), false);
});

test("refuses unsupported types, empty files and files above 10 MB before storage", async () => {
  assert.equal((await upload(technique, pdf, { type: "text/html" })).status, 415);
  assert.equal((await upload(technique, pdf, { type: "application/octet-stream" })).status, 415);
  assert.equal((await upload(technique, new Uint8Array(0))).status, 400);
  assert.equal((await upload(technique, new Uint8Array(maxFileBytes + 1))).status, 413);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/")), false);
});

test("checks the listing exists and the identifier format", async () => {
  assert.equal((await upload(technique, pdf, { propertyId: "pas-un-id" })).status, 400);
  knownListing = false;
  assert.equal((await upload(technique, pdf)).status, 404);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/private-files/")), false);
});

test("keeps only the base name of the file and removes control characters", async () => {
  await upload(technique, pdf, { name: "../../secret\u0007.pdf" });
  const row = calls.find((call) => call.url.includes("/rest/v1/listing_files") && call.method === "POST")?.body as Record<string, unknown>;
  assert.equal(row.original_name, "secret.pdf");
});

test("a failed storage upload stores nothing, and a failed metadata insert removes the object", async () => {
  storageUpload = 500;
  assert.equal((await upload(technique, pdf)).status, 503);
  assert.equal(calls.some((call) => call.url.includes("/rest/v1/listing_files")), false);

  reset();
  metadataInsert = 500;
  assert.equal((await upload(technique, pdf)).status, 503);
  assert.equal(calls.some((call) => call.method === "DELETE" && call.url.endsWith("/storage/v1/object/private-files")), true);
});

test("applies the file permissions per role", async () => {
  assert.equal((await upload(commercial, pdf)).status, 403);
  assert.equal((await upload(direction, pdf)).status, 403);
  assert.equal((await upload(reviewer, pdf)).status, 403);
  assert.equal((await send(commercial, `/api/admin/files?propertyId=${listingId}`)).status, 200);
  assert.equal((await send(direction, `/api/admin/files?propertyId=${listingId}`)).status, 200);
  assert.equal((await send(reviewer, `/api/admin/files?propertyId=${listingId}`)).status, 200);
  assert.equal((await upload(admin, pdf)).status, 201);
});

test("lists files without exposing storage paths", async () => {
  const body = await (await send(technique, `/api/admin/files?propertyId=${listingId}`)).json() as Array<Record<string, unknown>>;
  assert.deepEqual(body[0], { id: fileId, name: "bilan.pdf", type: "application/pdf", sizeBytes: 12, createdAt: "2026-11-09T09:00:00Z" });
  assert.equal(JSON.stringify(body).includes("listing/"), false);
  assert.equal((await send(technique, "/api/admin/files?propertyId=pas-un-id")).status, 400);
});

test("issues a short-lived download link on the storage service only", async () => {
  const response = await send(reviewer, `/api/admin/files/${fileId}/url`);
  assert.equal(response.status, 200);
  const body = await response.json() as { url: string; expiresInSeconds: number };
  assert.equal(body.expiresInSeconds, 60);
  assert.equal(new URL(body.url).origin, baseUrl);
  assert.match(body.url, /\/storage\/v1\/object\/sign\/private-files\/listing\//);
  const signRequest = calls.find((call) => call.url.includes("/object/sign/"));
  assert.deepEqual(signRequest?.body, { expiresIn: 60 });
});

test("any role that can read listings may request a download link; unknown files are refused", async () => {
  assert.equal((await send(commercial, `/api/admin/files/${fileId}/url`)).status, 200);
  assert.equal((await send(technique, "/api/admin/files/pas-un-id/url")).status, 404);
});

test("deletes the object before its metadata and keeps the record when storage fails", async () => {
  const response = await send(technique, `/api/admin/files/${fileId}`, "DELETE");
  assert.equal(response.status, 204);
  const storageIndex = calls.findIndex((call) => call.method === "DELETE" && call.url.endsWith("/storage/v1/object/private-files"));
  const rowIndex = calls.findIndex((call) => call.method === "DELETE" && call.url.includes("/rest/v1/listing_files"));
  assert.ok(storageIndex >= 0 && rowIndex > storageIndex);

  reset();
  storageDelete = 500;
  assert.equal((await send(technique, `/api/admin/files/${fileId}`, "DELETE")).status, 503);
  assert.equal(calls.some((call) => call.method === "DELETE" && call.url.includes("/rest/v1/listing_files")), false);
});

test("the audit trail records the action without the file name or content", async () => {
  await upload(technique, pdf, { name: "dossier-confidentiel.pdf" });
  const audit = calls.find((call) => call.url.includes("/rest/v1/audit_log"));
  const entry = audit?.body as Record<string, unknown> | undefined;
  assert.equal(entry?.action, "file.upload");
  assert.ok(!JSON.stringify(entry).includes("confidentiel"));
});
