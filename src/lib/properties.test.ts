import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterProperties, properties, type Property } from "./properties";

const terrains = properties.filter((property) => property.category === "terrain");
const homes = properties.filter((property) => property.category === "immobilier");

describe("filterProperties", () => {
  it("normalizes accents, case, and surrounding whitespace for location and region", () => {
    const byLocation = filterProperties(terrains, { localisation: "  THIAPONG " });
    const byRegion = filterProperties(terrains, { region: "thies" });

    assert.deepEqual(byLocation.map((property) => property.ref), ["T-0142"]);
    assert.deepEqual(byRegion.map((property) => property.ref), ["T-0142", "T-0186"]);
  });

  it("matches the property type and exact availability status", () => {
    assert.deepEqual(
      filterProperties(homes, { type: "villa" }).map((property) => property.ref),
      ["I-0042"],
    );
    assert.deepEqual(
      filterProperties(homes, { statut: "À louer" }).map((property) => property.ref),
      ["I-0054"],
    );
  });

  it("includes listings on both price and area boundaries", () => {
    const result = filterProperties(terrains, {
      prixMin: "18500000",
      prixMax: "27000000",
      surfaceMin: "300",
      surfaceMax: "450",
    });

    assert.deepEqual(result.map((property) => property.ref), ["T-0142", "T-0186"]);
  });

  it("uses the legacy budget maximum unless prixMax is provided", () => {
    assert.deepEqual(
      filterProperties(terrains, { budget: "16000000" }).map((property) => property.ref),
      ["T-0201"],
    );
    assert.deepEqual(
      filterProperties(terrains, { budget: "16000000", prixMax: "20000000" }).map((property) => property.ref),
      ["T-0142", "T-0201"],
    );
  });

  it("ignores invalid and negative numeric filters", () => {
    assert.deepEqual(
      filterProperties(terrains, { prixMin: "-1", prixMax: "invalid", surfaceMin: "invalid" }).map((property) => property.ref),
      terrains.map((property) => property.ref),
    );
  });

  it("sorts by price and surface in both directions without mutating the input", () => {
    const listings: Property[] = [
      { ...homes[0], price: 300, area: 100 },
      { ...homes[1], price: 100, area: 300 },
      { ...homes[2], price: 200, area: 200 },
    ];
    const originalOrder = listings.map((property) => property.ref);

    assert.deepEqual(filterProperties(listings, { tri: "prix-croissant" }).map((property) => property.ref), ["I-0042", "I-0054", "I-0038"]);
    assert.deepEqual(filterProperties(listings, { tri: "prix-decroissant" }).map((property) => property.ref), ["I-0038", "I-0054", "I-0042"]);
    assert.deepEqual(filterProperties(listings, { tri: "surface-croissante" }).map((property) => property.ref), ["I-0038", "I-0054", "I-0042"]);
    assert.deepEqual(filterProperties(listings, { tri: "surface-decroissante" }).map((property) => property.ref), ["I-0042", "I-0054", "I-0038"]);
    assert.deepEqual(filterProperties(listings, {}).map((property) => property.ref), originalOrder);
    assert.deepEqual(listings.map((property) => property.ref), originalOrder);
  });
});
