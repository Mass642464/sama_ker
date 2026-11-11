import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distanceKm, formatApproximateDistance, sortByDistance } from "./geo";

describe("geo helpers", () => {
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
