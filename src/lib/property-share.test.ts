import { strict as assert } from "node:assert";
import { test } from "node:test";
import { propertyPath, propertyShareDetails } from "./property-share";

test("builds direct category URLs and encoded sharing messages", () => {
  const property = { category: "terrain" as const, slug: "bien-é", title: "Terrain & jardin", ref: "T-1", location: "Saly", priceLabel: "15 000 FCFA" };
  const share = propertyShareDetails(property, "https://example.test");
  assert.equal(share.url, "https://example.test/terrains/bien-%C3%A9");
  assert.match(new URL(share.whatsapp).searchParams.get("text") ?? "", /15 000 FCFA · Saly/);
  assert.ok(new URL(share.whatsapp).searchParams.get("text")?.includes(share.url));
  assert.equal(new URL(share.facebook).searchParams.get("u"), share.url);
  assert.equal(propertyPath({ category: "immobilier", slug: "maison" }), "/immobilier/maison");
});
