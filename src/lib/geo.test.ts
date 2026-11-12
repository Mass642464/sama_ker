import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanceKm, formatApproximateDistance, isInMapBounds, sortByDistance } from "./geo";
import { parseGeoJson } from "./geometry-import";

describe("geo helpers", () => {
  it("selects visible points including bounds and supports a view crossing the date line", () => {
    const bounds = { north: 16, south: 14, west: -18, east: -16 };
    assert.equal(isInMapBounds({ lat: 14, lng: -18 }, bounds), true);
    assert.equal(isInMapBounds({ lat: 13, lng: -17 }, bounds), false);
    assert.equal(isInMapBounds({ lat: 15, lng: -15 }, bounds), false);
    const crossed = { north: 20, south: -20, west: 170, east: -170 };
    assert.equal(isInMapBounds({ lat: 0, lng: 179 }, crossed), true);
    assert.equal(isInMapBounds({ lat: 0, lng: -179 }, crossed), true);
    assert.equal(isInMapBounds({ lat: 0, lng: 0 }, crossed), false);
  });

  describe("importation GeoJSON", () => {
    it("normalise les géométries et retire les propriétés", () => {
      const result = parseGeoJson({ type: "FeatureCollection", features: [
        { type: "Feature", properties: { secret: "privé" }, geometry: { type: "Point", coordinates: [-17, 14, 20] } },
        { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[-17, 14], [-16, 14], [-16, 15], [-17, 14]]] } },
      ] });
      assert.equal(result.features.length, 2);
      assert.deepEqual(result.features[0], { type: "Feature", properties: null, geometry: { type: "Point", coordinates: [-17, 14] } });
      assert.equal(JSON.stringify(result).includes("privé"), false);
    });
    it("refuse les coordonnées invalides, les contours ouverts et les CRS personnalisés", () => {
      assert.throws(() => parseGeoJson({ type: "Point", coordinates: [181, 14] }), /Coordonnées invalides/);
      assert.throws(() => parseGeoJson({ type: "Point", coordinates: [0, "14"] }), /Coordonnées invalides/);
      assert.throws(() => parseGeoJson({ type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }), /fermé/);
      assert.throws(() => parseGeoJson({ type: "Point", coordinates: [0, 0], crs: {} }), /WGS 84/);
    });
    it("applique les limites et rejette les géométries inconnues", () => {
      assert.throws(() => parseGeoJson({ type: "GeometryCollection", geometries: Array.from({ length: 251 }, () => ({ type: "Point", coordinates: [0, 0] })) }), /250/);
      assert.throws(() => parseGeoJson({ type: "LineString", coordinates: Array.from({ length: 10001 }, () => [0, 0]) }), /10 000/);
      assert.throws(() => parseGeoJson({ type: "Circle", coordinates: [0, 0] }), /non pris en charge/);
    });
  });
  it("computes the great-circle distance between two points", () => {
    const dakar = { lat: 14.716, lng: -17.467 };
    const thies = { lat: 14.791, lng: -16.926 };
    assert.equal(distanceKm(dakar, dakar), 0);
    const km = distanceKm(dakar, thies);
    assert.ok(km > 55 && km < 62, `distance Dakar-Thiès inattendue : ${km}`);
    assert.ok(Math.abs(distanceKm(dakar, thies) - distanceKm(thies, dakar)) < 1e-9);
  });

  it("only exposes coarse distances because published locations are rounded", () => {
    assert.equal(formatApproximateDistance(0.4), "moins de 2 km");
    assert.equal(formatApproximateDistance(6.4), "environ 6 km");
    assert.equal(formatApproximateDistance(58), "environ 60 km");
  });

  it("sorts located items by distance and keeps unlocated ones last without mutating the input", () => {
    const origin = { lat: 14.7, lng: -17.4 };
    const items = [
      { id: "far", coordinates: { lat: 16.0, lng: -16.5 } },
      { id: "none" },
      { id: "near", coordinates: { lat: 14.71, lng: -17.45 } },
    ];
    const sorted = sortByDistance(items, origin);
    assert.deepEqual(sorted.map((item) => item.id), ["near", "far", "none"]);
    assert.equal(sorted[2].distanceKm, null);
    assert.deepEqual(items.map((item) => item.id), ["far", "none", "near"]);
  });
});
