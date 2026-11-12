import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { detectVaultType, handleClientVault } from "./client-vault";
import { hasRecentPasswordAuthentication } from "./user-auth";

const userId = "28e23e9e-38a3-4f92-aa05-743f28c3bd37";
const fileId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const originalFetch = globalThis.fetch;
const savedEnvironment = Object.fromEntries(
  ["CLIENT_VAULT_ENABLED"].map((key) => [key, process.env[key]]),
);
const config = { baseUrl: "https://supabase.example.test", serviceRoleKey: "synthetic-service-role-key" };
const user = { id: userId, email: "client@example.test" };
const calls: { url: string; method: string; contentType: string | null; body: string | undefined }[] = [];

function token(payload: Record<string, unknown> = {}) {
  const body = Buffer.from(JSON.stringify({ auth_time: Math.floor(Date.now() / 1000), amr: [{ method: "password" }], ...payload })).toString("base64url");
  return `header.${body}.signature`;
}

function request(path = "/api/client/vault", method = "GET", headers: Record<string, string> = {}, body?: BodyInit) {
  return new Request(`https://backend.example.test${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, ...headers },
    ...(body === undefined ? {} : { body }),
  });
}

function set16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function set32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function docxZip() {
  const names = ["[Content_Types].xml", "word/document.xml"];
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  for (const name of names) {
    const encoded = new TextEncoder().encode(name);
    const local = new Uint8Array(30 + encoded.length);
    const localView = new DataView(local.buffer);
    set32(localView, 0, 0x04034b50);
    set16(localView, 26, encoded.length);
    local.set(encoded, 30);
    locals.push(local);

    const central = new Uint8Array(46 + encoded.length);
    const centralView = new DataView(central.buffer);
    set32(centralView, 0, 0x02014b50);
    set16(centralView, 28, encoded.length);
    set32(centralView, 42, localOffset);
    central.set(encoded, 46);
    centrals.push(central);
    localOffset += local.length;
  }
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  set32(endView, 0, 0x06054b50);
  set16(endView, 8, names.length);
  set16(endView, 10, names.length);
  set32(endView, 12, centralSize);
  set32(endView, 16, localOffset);
  return new Uint8Array([...locals, ...centrals, end].reduce((all, item) => [...all, ...item], [] as number[]));
}

before(() => {
  process.env.CLIENT_VAULT_ENABLED = "true";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const contentType = new Headers(init?.headers).get("content-type");
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method, contentType, body });
    if (url.includes("/rest/v1/client_vault_files") && method === "GET") {
      return Response.json(url.includes("select=object_path") ? [{ object_path: `client/${userId}/file.pdf` }] : [
        { id: fileId, original_name: "document.pdf", mime_type: "application/pdf", size_bytes: 1234, created_at: "2026-11-12T10:00:00Z" },
      ]);
    }
    if (url.includes("/rest/v1/client_vault_access_log") && method === "GET") {
      return Response.json([{ file_id: fileId, accessed_at: "2026-11-12T10:10:00Z" }]);
    }
    if (url.includes("/rpc/save_client_vault_file")) return Response.json([{ id: fileId }], { status: 200 });
    if (url.includes("/rpc/log_client_vault_access")) return Response.json(null);
    if (url.includes("/storage/v1/object/sign/client-vault/")) {
      return Response.json({ signedURL: `/object/sign/client-vault/client/${userId}/file.pdf?token=synthetic` });
    }
    if (url.includes("/storage/v1/object/client-vault")) return new Response(null, { status: 200 });
    return new Response(null, { status: 204 });
  };
});

beforeEach(() => { calls.length = 0; });

after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("requires a recent password authentication and detects supported file signatures", () => {
  assert.equal(hasRecentPasswordAuthentication(request()), true);
  assert.equal(hasRecentPasswordAuthentication(request("/api/client/vault", "GET", { authorization: `Bearer ${token({ auth_time: Math.floor(Date.now() / 1000) - 1801 })}` })), false);
  assert.equal(hasRecentPasswordAuthentication(request("/api/client/vault", "GET", { authorization: `Bearer ${token({ amr: [{ method: "otp" }] })}` })), false);
  assert.equal(detectVaultType(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf"), true);
  assert.equal(detectVaultType(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"), true);
  assert.equal(detectVaultType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
  assert.equal(detectVaultType(docxZip(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), true);
  assert.equal(detectVaultType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), false);
});

test("lists only the caller's vault metadata and access history", async () => {
  const response = await handleClientVault(request(), user, ["vault"], config);
  assert.equal(response?.status, 200);
  const body = await response?.json() as { files: Array<Record<string, unknown>>; accesses: Array<Record<string, unknown>> };
  assert.equal(body.files.length, 1);
  assert.equal("object_path" in body.files[0], false);
  assert.equal(body.accesses[0].fileId, fileId);
  assert.ok(calls.every((call) => call.url.includes(`user_id=eq.${userId}`)));
});

test("refuses access when the password is stale and refuses unsupported upload content", async () => {
  const stale = request("/api/client/vault", "GET", { authorization: `Bearer ${token({ auth_time: Math.floor(Date.now() / 1000) - 1801 })}` });
  assert.equal((await handleClientVault(stale, user, ["vault"], config))?.status, 428);
  const invalid = request("/api/client/vault/files", "POST", { "content-type": "image/png", "x-file-name": "fake.png" }, new Uint8Array([0, 1, 2]));
  assert.equal((await handleClientVault(invalid, user, ["vault", "files"], config))?.status, 400);
  assert.equal(calls.some((call) => call.url.startsWith("https://supabase.example.test/storage/")), false);
});

test("uploads checked files under a caller-scoped private path", async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
  const uploadRequest = request("/api/client/vault/files", "POST", {
    "content-type": "image/jpeg", "content-length": String(bytes.length), "x-file-name": encodeURIComponent("ma-photo.jpg"),
  }, bytes);
  const response = await handleClientVault(uploadRequest, user, ["vault", "files"], config);
  assert.equal(response?.status, 201);
  const object = calls.find((call) => call.url.includes("/storage/v1/object/client-vault/"));
  assert.ok(object?.url.includes(`/client/${userId}/`));
  assert.equal(object?.contentType, "image/jpeg");
});

test("signs a short-lived link only for the caller's file and logs the access", async () => {
  const response = await handleClientVault(request(`/api/client/vault/files/${fileId}`), user, ["vault", "files", fileId], config);
  assert.equal(response?.status, 200);
  const result = await response?.json() as { url: string; expiresInSeconds: number };
  assert.equal(result.expiresInSeconds, 60);
  assert.match(result.url, /^https:\/\/supabase\.example\.test\/storage\/v1\/object\/sign\/client-vault\//);
  const log = calls.find((call) => call.url.includes("/rpc/log_client_vault_access"));
  assert.deepEqual(JSON.parse(log?.body ?? "{}"), { p_user: userId, p_file: fileId });
});

test("removes the private object before deleting its metadata", async () => {
  const response = await handleClientVault(request(`/api/client/vault/files/${fileId}`, "DELETE"), user, ["vault", "files", fileId], config);
  assert.equal(response?.status, 204);
  const objectIndex = calls.findIndex((call) => call.url.includes("/storage/v1/object/client-vault") && call.method === "DELETE");
  const metadataIndex = calls.findIndex((call) => call.url.includes("/rest/v1/client_vault_files") && call.method === "DELETE");
  assert.ok(objectIndex >= 0 && metadataIndex > objectIndex);
  assert.ok(calls[metadataIndex].url.includes(`user_id=eq.${userId}`));
});
