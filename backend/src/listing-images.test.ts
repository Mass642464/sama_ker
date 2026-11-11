import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { handleAdminRequest } from "./admin-router";
import { handlePublicListingImage, maxImageBytes } from "./listing-images";
import { getConfig } from "./admin";
import { createBackendServer } from "./server";

const origin = "http://localhost:3000";
const allowed = new Set([origin]);
const baseUrl = "https://supabase.example.test";
const listingId = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const imagePath = "8f13bb61-2cc6-4c72-83aa-58feebd7ef44.png";
const imageUrl = `${baseUrl}/storage/v1/object/authenticated/listing-images/${imagePath}`;
const token = "token-admin-0000000000000";
const readOnlyToken = "token-direction-000000000000";
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const originalFetch = globalThis.fetch;
const savedEnvironment = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAILS", "ALLOWED_ORIGINS"].map((key) => [key, process.env[key]]),
);

let calls: { url: string; method: string; body: unknown; headers: Headers }[] = [];
let mediaRows: unknown[] = [];
let publishedListing = true;
let adminListings: unknown[] = [];

function reset() {
  calls = [];
  mediaRows = [];
  publishedListing = true;
  adminListings = [];
}

before(() => {
  process.env.SUPABASE_URL = baseUrl;
  process.env.SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role-key";
  process.env.ADMIN_EMAILS = "admin@example.test";
  process.env.ALLOWED_ORIGINS = origin;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body) as unknown;
      } catch {
        body = init.body;
      }
    } else body = init?.body;
    calls.push({ url, method, body, headers });

    if (url.endsWith("/auth/v1/user")) {
      const email = headers.get("authorization") === `Bearer ${readOnlyToken}` ? "direction@example.test" : "admin@example.test";
      return Response.json({ id: "28e23e9e-38a3-4f92-aa05-743f28c3bd37", email, email_confirmed_at: "2026-11-09T09:00:00Z" });
    }
    if (url.includes("/rest/v1/staff_members")) return Response.json([{ role: "direction" }]);
    if (url.includes("/storage/v1/object/sign/listing-images")) {
      const requestBody = body as { paths?: string[] };
      return Response.json((requestBody.paths ?? []).map((path) => ({
        path,
        signedURL: `/object/sign/listing-images/${path}?token=synthetic-preview`,
      })));
    }
    if (url.includes("/storage/v1/object/listing-images/") && method === "POST") {
      return Response.json({ Key: `listing-images/${imagePath}` });
    }
    if (url.endsWith("/storage/v1/object/listing-images") && method === "DELETE") return new Response(null, { status: 200 });
    if (url.includes("/rest/v1/audit_log")) return new Response(null, { status: 201 });
    if (url.includes("/rest/v1/property_listing_media")) return Response.json(mediaRows);
    if (url.includes("/rest/v1/property_listings")) {
      if (url.includes("publication_status=eq.published")) {
        return Response.json(publishedListing ? [{ id: listingId }] : []);
      }
      return Response.json(adminListings);
    }
    return Response.json([]);
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

function adminRequest(method: "POST" | "GET" | "DELETE", path: string, body?: Uint8Array, contentType = "image/png", accessToken = token) {
  return handleAdminRequest(new Request(`https://backend.example.test${path}`, {
    method,
    headers: {
      Origin: origin,
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": contentType, "Content-Length": String(body.length) } : {}),
    },
    ...(body ? { body: body as unknown as BodyInit } : {}),
  }), allowed);
}

test("uploads checked local image bytes to the private bucket and returns an admin-only preview", async () => {
  const response = await adminRequest("POST", "/api/admin/listing-images", png);
  assert.equal(response.status, 201);
  const payload = await response.json() as { src: string; previewSrc: string };
  assert.match(payload.src, /\/storage\/v1\/object\/authenticated\/listing-images\/[0-9a-f-]{36}\.png$/);
  assert.match(payload.previewSrc, /\/storage\/v1\/object\/sign\/listing-images\/.*synthetic-preview/);
  const upload = calls.find((call) => call.url.includes("/storage/v1/object/listing-images/"));
  assert.equal(upload?.method, "POST");
  assert.equal((upload?.body as Blob).size, png.length);
  assert.equal(upload?.headers.get("content-type"), "image/png");
});

test("rejects mismatched media before uploading", async () => {
  const response = await adminRequest("POST", "/api/admin/listing-images", png, "image/jpeg");
  assert.equal(response.status, 400);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/listing-images/")), false);
});

test("refuses photo uploads from read-only staff roles", async () => {
  const response = await adminRequest("POST", "/api/admin/listing-images", png, "image/png", readOnlyToken);
  assert.equal(response.status, 403);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/listing-images/")), false);
});

test("accepts images below 10 MiB and rejects files at the 10 MiB boundary", async () => {
  const belowLimit = new Uint8Array(maxImageBytes);
  belowLimit.set(png);
  const accepted = await adminRequest("POST", "/api/admin/listing-images", belowLimit);
  assert.equal(accepted.status, 201);

  reset();
  const boundary = new Uint8Array(maxImageBytes + 1);
  boundary.set(png);
  const rejected = await adminRequest("POST", "/api/admin/listing-images", boundary);
  assert.equal(rejected.status, 413);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/listing-images/")), false);
});

test("the HTTP server accepts a 239 KB binary image body instead of applying the JSON body limit", async () => {
  const server = createBackendServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const bytes = new Uint8Array(239 * 1024 + 102);
  bytes.set(png);
  try {
    const response = await originalFetch(`http://127.0.0.1:${address.port}/api/admin/listing-images`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "image/png" },
      body: bytes,
    });
    assert.equal(response.status, 401);
    assert.notEqual(response.status, 413);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("admin listings receive short-lived signed previews instead of private object URLs", async () => {
  adminListings = [{
    id: listingId,
    slug: "maison-test",
    reference: "I-TEST-01",
    category: "immobilier",
    title: "Maison de test",
    region: "Thiès",
    location_label: "Zone de test",
    price_amount: "1000000",
    price_period: "total",
    area_m2: "100",
    property_type: "Maison",
    availability_status: "Disponible",
    description: "Annonce synthétique réservée à un test automatisé.",
    features: [],
    publication_status: "review",
    public_latitude: null,
    public_longitude: null,
    listing_review_state: { revision: 1 },
    property_listing_media: [{ image_url: imageUrl, alt_text: "Photo de façade réservée au test", credit: "Fichier de test", source_url: null, position: 0 }],
  }];
  const response = await adminRequest("GET", "/api/admin/properties");
  assert.equal(response.status, 200);
  const [listing] = await response.json() as { photos: { src: string; previewSrc: string }[] }[];
  assert.equal(listing.photos[0].src, imageUrl);
  assert.match(listing.photos[0].previewSrc, /object\/sign\/listing-images/);
});

test("refuses public image delivery until both media and listing are published", async () => {
  const config = getConfig();
  assert.ok(config);
  const request = new Request(`https://backend.example.test/api/public/listing-images/${imagePath}`);

  const unpublishedMedia = await handlePublicListingImage(request, config, [imagePath]);
  assert.equal(unpublishedMedia.status, 404);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/sign/listing-images")), false);

  mediaRows = [{ property_id: listingId }];
  publishedListing = false;
  const unpublishedListing = await handlePublicListingImage(request, config, [imagePath]);
  assert.equal(unpublishedListing.status, 404);
  assert.equal(calls.some((call) => call.url.includes("/storage/v1/object/sign/listing-images")), false);
});

test("redirects to a short-lived URL only for a published image", async () => {
  const config = getConfig();
  assert.ok(config);
  mediaRows = [{ property_id: listingId }];
  const response = await handlePublicListingImage(
    new Request(`https://backend.example.test/api/public/listing-images/${imagePath}`),
    config,
    [imagePath],
  );
  assert.equal(response.status, 302);
  assert.match(response.headers.get("location") ?? "", /object\/sign\/listing-images/);
  assert.equal(response.headers.get("cache-control"), "private, max-age=30");
});

test("deletes only an unreferenced private image", async () => {
  const response = await adminRequest("DELETE", `/api/admin/listing-images?src=${encodeURIComponent(imageUrl)}`);
  assert.equal(response.status, 204);
  assert.equal(calls.some((call) => call.method === "DELETE" && call.url.endsWith("/storage/v1/object/listing-images")), true);

  reset();
  mediaRows = [{ id: "4f6c11f1-8c28-4a2e-bd43-81192a7e4a6d" }];
  const referenced = await adminRequest("DELETE", `/api/admin/listing-images?src=${encodeURIComponent(imageUrl)}`);
  assert.equal(referenced.status, 409);
  assert.equal(calls.some((call) => call.method === "DELETE" && call.url.endsWith("/storage/v1/object/listing-images")), false);
});
