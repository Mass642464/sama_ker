export const geoFields = ["area", "location", "latitude", "longitude", "zone", "access", "environment", "geometry"] as const;
export type GeoField = typeof geoFields[number];
export type Reliability = "unknown" | "declared" | "verified" | "outdated";
export type GeoEntry = { value: string; source: string; date: string; reliability: Reliability };
export type GeoProfile = Record<GeoField, GeoEntry | null>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validPolygon(text: string): boolean {
  let geometry: unknown;
  try { geometry = JSON.parse(text); }
  catch { return false; }
  if (!isObject(geometry) || geometry.type !== "Polygon" || Object.keys(geometry).some((key) => key !== "type" && key !== "coordinates")) return false;
  if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return false;
  let count = 0;
  for (const ring of geometry.coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    for (const position of ring) {
      if (!Array.isArray(position) || position.length !== 2 ||
        typeof position[0] !== "number" || !Number.isFinite(position[0]) || position[0] < -17.8 || position[0] > -11.3 ||
        typeof position[1] !== "number" || !Number.isFinite(position[1]) || position[1] < 12 || position[1] > 16.8 ||
        ++count > 200) return false;
    }
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) return false;
  }
  return true;
}

export function parseGeoProfile(input: unknown): GeoProfile | null {
  if (!isObject(input) || Object.keys(input).length !== geoFields.length || geoFields.some((key) => !(key in input))) return null;
  const result = {} as GeoProfile;
  for (const key of geoFields) {
    const entry = input[key];
    if (entry === null) { result[key] = null; continue; }
    if (!isObject(entry) || Object.keys(entry).length !== 4 ||
      typeof entry.value !== "string" || !entry.value.trim() || entry.value.length > 10_000 ||
      typeof entry.source !== "string" || !entry.source.trim() || entry.source.length > 200 ||
      typeof entry.date !== "string" || !validDate(entry.date) ||
      (entry.reliability !== "unknown" && entry.reliability !== "declared" && entry.reliability !== "verified" && entry.reliability !== "outdated")) return null;
    const value = entry.value.trim();
    if (key === "geometry" ? !validPolygon(value) : value.length > 500) return null;
    if (key === "area" || key === "latitude" || key === "longitude") {
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) return null;
      const number = Number(value);
      if (!Number.isFinite(number) || (key === "area" && (number <= 0 || number > 1_000_000_000)) ||
        (key === "latitude" && (number < 12 || number > 16.8)) ||
        (key === "longitude" && (number < -17.8 || number > -11.3))) return null;
    }
    result[key] = { value, source: entry.source.trim(), date: entry.date, reliability: entry.reliability };
  }
  if ((result.latitude === null) !== (result.longitude === null)) return null;
  return result;
}
