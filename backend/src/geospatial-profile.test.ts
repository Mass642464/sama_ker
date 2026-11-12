import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { geoFields, parseGeoProfile } from "./geospatial-profile-schema";
import { handleGeospatialProfile } from "./geospatial-profile";

const blank = () => Object.fromEntries(geoFields.map((key) => [key, null]));
const entry = (value: string) => ({ value, source: "Relevé de test", date: "2026-01-31", reliability: "declared" });
const id = "92c82112-63d1-4ad2-8df9-320e7b5cf7dc";
const config = { baseUrl: "https://example.test", anonKey: "test", serviceRoleKey: "test", allowedEmails: [] };
const previous = process.env.GEOSPATIAL_PROFILE_ENABLED;
const originalFetch = globalThis.fetch;
let calls: string[] = [];
let mode: "normal" | "conflict" | "not-terrain" = "normal";

before(() => {
  process.env.GEOSPATIAL_PROFILE_ENABLED = "true";
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.includes("property_listings?")) return Response.json([{ id, category: mode === "not-terrain" ? "immobilier" : "terrain" }]);
    if (init?.method === "PATCH") return Response.json(mode === "conflict" ? [] : [{ revision: 2, updated_at: "2026-01-01T00:00:00Z" }]);
    if (init?.method === "POST") return Response.json([{ revision: 1, updated_at: "2026-01-01T00:00:00Z" }]);
    return Response.json([]);
  };
});

after(() => {
  globalThis.fetch = originalFetch;
  if (previous === undefined) delete process.env.GEOSPATIAL_PROFILE_ENABLED;
  else process.env.GEOSPATIAL_PROFILE_ENABLED = previous;
});

function request(method: string, body?: unknown) {
  return new Request(`https://backend.example.test/api/admin/geospatial-profile/${id}`, {
    method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
}

test("validates source, date, reliability, numeric bounds, coordinate pair and polygon", () => {
  const polygon = JSON.stringify({ type: "Polygon", coordinates: [[[-17, 14], [-16, 14], [-16, 15], [-17, 14]]] });
  const valid = { ...blank(), area: entry("300"), latitude: entry("14.5"), longitude: entry("-17.2"), geometry: entry(polygon) };
  assert.ok(parseGeoProfile(valid));
  assert.equal(parseGeoProfile({ ...valid, latitude: null }), null);
  assert.equal(parseGeoProfile({ ...valid, area: entry("-1") }), null);
  assert.equal(parseGeoProfile({ ...valid, longitude: entry("-180") }), null);
  assert.equal(parseGeoProfile({ ...valid, area: { ...entry("300"), source: " " } }), null);
  assert.equal(parseGeoProfile({ ...valid, area: { ...entry("300"), date: "2026-02-30" } }), null);
  assert.equal(parseGeoProfile({ ...valid, area: { ...entry("300"), reliability: "" } }), null);
  assert.equal(parseGeoProfile({ ...valid, geometry: entry(JSON.stringify({ type: "Polygon", coordinates: [[[-17, 14], [-16, 14], [-16, 15], [-17, 15]]] })) }), null);
  assert.equal(parseGeoProfile({ ...valid, geometry: entry(JSON.stringify({ type: "Polygon", crs: {}, coordinates: [] })) }), null);
  assert.equal(parseGeoProfile({ ...valid, geometry: entry(JSON.stringify({ type: "Polygon", coordinates: [Array.from({ length: 201 }, () => [-17, 14])] })) }), null);
});

test("feature gate and listing type prevent access", async () => {
  process.env.GEOSPATIAL_PROFILE_ENABLED = "false";
  calls = [];
  assert.equal((await handleGeospatialProfile(request("GET"), config, [id])).status, 503);
  assert.equal(calls.length, 0);
  process.env.GEOSPATIAL_PROFILE_ENABLED = "true";
  mode = "not-terrain";
  assert.equal((await handleGeospatialProfile(request("GET"), config, [id])).status, 404);
  mode = "normal";
});

test("reads and saves private profile using optimistic revision checks", async () => {
  calls = [];
  const response = await handleGeospatialProfile(request("GET"), config, [id]);
  assert.deepEqual(await response.json(), { profile: null, revision: 0, updatedAt: null });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await handleGeospatialProfile(request("PUT", { revision: 0, profile: blank() }), config, [id])).status, 200);
  assert.equal((await handleGeospatialProfile(request("PUT", { revision: 1, profile: blank() }), config, [id])).status, 200);
  assert.ok(calls.some((url) => url.includes(`revision=eq.1`)));
  mode = "conflict";
  assert.equal((await handleGeospatialProfile(request("PUT", { revision: 1, profile: blank() }), config, [id])).status, 409);
  mode = "normal";
  assert.equal((await handleGeospatialProfile(request("PUT", { revision: 1, profile: { ...blank(), area: entry("0") } }), config, [id])).status, 400);
});
