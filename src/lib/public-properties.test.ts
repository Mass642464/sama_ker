import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPublicListings, publicPhotoProxyUrl } from "./public-properties";

const publishedListing = {
  slug: "terrain-test-senegal",
  reference: "T-TEST-01",
  category: "terrain",
  title: "Terrain de démonstration de test",
  region: "Thiès",
  location_label: "Zone générale à confirmer",
  price_amount: "18500000",
  price_period: "total",
  area_m2: "300",
  property_type: "Terrain résidentiel",
  availability_status: "Disponible",
  description: "Annonce de test avec des données synthétiques réservées aux tests.",
  features: ["Caractéristique de test"],
  property_listing_media: [
    {
      image_url: "https://example.com/property.jpg",
      alt_text: "Image synthétique réservée au test automatisé",
      credit: "Fichier de test",
      source_url: "https://example.com/source",
    },
  ],
};

describe("mapPublicListings", () => {
  it("maps published public fields without marking a listing as verified", () => {
    const [property] = mapPublicListings([publishedListing]);

    assert.equal(property.isDemo, false);
    assert.equal(property.verified, false);
    assert.equal(property.ref, "T-TEST-01");
    assert.equal(property.location, "Zone générale à confirmer, Thiès");
    assert.equal(property.price, 18_500_000);
    assert.match(property.priceLabel, /18.?500.?000 FCFA/);
    assert.equal(property.photos?.[0].src, "https://example.com/property.jpg");
  });

  describe("publicPhotoProxyUrl", () => {
    const image = "https://project.supabase.co/storage/v1/object/authenticated/listing-images/8f13bb61-2cc6-4c72-83aa-58feebd7ef44.webp";

    it("uses the backend publication gate for private listing images", () => {
      assert.equal(
        publicPhotoProxyUrl(image, "https://project.supabase.co", "https://api.example.test"),
        "https://api.example.test/api/public/listing-images/8f13bb61-2cc6-4c72-83aa-58feebd7ef44.webp",
      );
    });

    it("leaves unrelated public images unchanged", () => {
      assert.equal(publicPhotoProxyUrl("https://images.example.test/photo.jpg", "https://project.supabase.co", undefined), "https://images.example.test/photo.jpg");
    });

    it("rejects malformed or unsafe private storage URLs", () => {
      assert.throws(
        () => publicPhotoProxyUrl("https://project.supabase.co/storage/v1/object/authenticated/listing-images/%2e%2e%2Fprivate.png", "https://project.supabase.co", "https://api.example.test"),
        /invalid private listing photo path/,
      );
      assert.throws(() => publicPhotoProxyUrl(image, "https://project.supabase.co", undefined), /NEXT_PUBLIC_API_URL/);
    });
  });

  it("formats monthly prices explicitly", () => {
    const [property] = mapPublicListings([{ ...publishedListing, price_period: "monthly" }]);
    assert.match(property.priceLabel, /\/ mois$/);
  });

  it("maps an approximate public location only when both coordinates are valid", () => {
    assert.equal(mapPublicListings([publishedListing])[0].coordinates, undefined);
    const [located] = mapPublicListings([{ ...publishedListing, public_latitude: "14.79", public_longitude: "-16.93" }]);
    assert.deepEqual(located.coordinates, { lat: 14.79, lng: -16.93 });
    for (const invalid of [
      { public_latitude: "14.79", public_longitude: null },
      { public_latitude: 48.85, public_longitude: 2.35 },
      { public_latitude: "abc", public_longitude: "-16.93" },
    ]) {
      assert.throws(() => mapPublicListings([{ ...publishedListing, ...invalid }]), /location/);
    }
  });

  it("rejects malformed rows rather than silently presenting partial listings", () => {
    assert.throws(() => mapPublicListings([{ ...publishedListing, slug: "../private" }]), /invalid slug/);
    assert.throws(() => mapPublicListings([{ ...publishedListing, region: "" }]), /region/);
    assert.throws(
      () => mapPublicListings([{ ...publishedListing, property_listing_media: [{ ...publishedListing.property_listing_media[0], image_url: "http://example.com/image.jpg" }] }]),
      /HTTPS/,
    );
    assert.throws(() => mapPublicListings({}), /invalid public listings response/);
  });
});
