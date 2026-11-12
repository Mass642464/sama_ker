import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterProperties, properties, type Property } from "./properties";
import { parseSearchQuery } from "./search-query";

const terrains = properties.filter((property) => property.category === "terrain");
const homes = properties.filter((property) => property.category === "immobilier");

describe("filterProperties", () => {
  it("interprets a natural language search and combines it with filters", () => {
    const q = "Terrain de 300 à 500 m² à Saly, avec un budget inférieur à 15 millions FCFA.";
    const parsed = parseSearchQuery(q);
    assert.equal(parsed.category, "terrain");
    assert.equal(parsed.localisation, "saly");
    assert.equal(parsed.surfaceMin, 300);
    assert.equal(parsed.surfaceMax, 500);
    assert.equal(parsed.prixMax, 14_999_999);
    assert.deepEqual(parsed.keywords, []);
    const listings = [
      { ...terrains[1], ref: "MATCH", price: 14_000_000, area: 300 },
      { ...terrains[1], ref: "LIMIT", price: 15_000_000, area: 500 },
      { ...terrains[1], ref: "AREA", price: 10_000_000, area: 501 },
    ];
    assert.deepEqual(filterProperties(listings, { q }).map((property) => property.ref), ["MATCH"]);
    assert.deepEqual(filterProperties(listings, { q, prixMax: "13000000" }), []);
  });

  it("matches free keywords and refuses unsupported proximity searches", () => {
    assert.deepEqual(filterProperties(homes, { q: "villa jardin" }).map((property) => property.ref), ["I-0042"]);
    assert.deepEqual(filterProperties(terrains, { q: "terrain proche d'une école" }), []);
    assert.equal(parseSearchQuery("terrain proche d'une école").unsupportedProximity, true);
  });

  it("orders real listings by publication date", () => {
    const listings = [{ ...terrains[0], publishedAt: "2026-01-01T00:00:00Z" }, { ...terrains[1], publishedAt: "2026-02-01T00:00:00Z" }];
    assert.deepEqual(filterProperties(listings, { tri: "nouveautes" }).map((property) => property.ref), ["T-0186", "T-0142"]);
  });

  it("ranks keyword matches in titles above matches only in descriptions", () => {
    const listings = [
      { ...terrains[0], ref: "DESCRIPTION", title: "Terrain résidentiel", description: "Jardin arboré" },
      { ...terrains[1], ref: "TITLE", title: "Terrain avec jardin", description: "Parcelle résidentielle" },
    ];
    assert.deepEqual(filterProperties(listings, { q: "jardin", tri: "pertinence" }).map((property) => property.ref), ["TITLE", "DESCRIPTION"]);
  });
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
