export type MapView = { center: { lat: number; lng: number }; zoom: number };

// Vues générales servant uniquement à centrer la carte sur une région (chef-lieu approximatif).
// Elles ne représentent la position d’aucun bien.
export const senegalView: MapView = { center: { lat: 14.5, lng: -14.45 }, zoom: 6 };

const regionViews: Record<string, MapView> = {
  dakar: { center: { lat: 14.716, lng: -17.467 }, zoom: 10 },
  thies: { center: { lat: 14.791, lng: -16.926 }, zoom: 9 },
  diourbel: { center: { lat: 14.655, lng: -16.231 }, zoom: 9 },
  fatick: { center: { lat: 14.339, lng: -16.411 }, zoom: 9 },
  kaolack: { center: { lat: 14.152, lng: -16.076 }, zoom: 9 },
  kaffrine: { center: { lat: 14.106, lng: -15.548 }, zoom: 9 },
  louga: { center: { lat: 15.618, lng: -16.224 }, zoom: 9 },
  "saint-louis": { center: { lat: 16.018, lng: -16.489 }, zoom: 9 },
  matam: { center: { lat: 15.656, lng: -13.255 }, zoom: 9 },
  tambacounda: { center: { lat: 13.77, lng: -13.667 }, zoom: 8 },
  kedougou: { center: { lat: 12.557, lng: -12.175 }, zoom: 9 },
  kolda: { center: { lat: 12.883, lng: -14.95 }, zoom: 9 },
  sedhiou: { center: { lat: 12.708, lng: -15.557 }, zoom: 9 },
  ziguinchor: { center: { lat: 12.583, lng: -16.272 }, zoom: 9 },
};

function normalizeRegion(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, "-");
}

export function getRegionView(region: string | undefined): MapView | null {
  return region ? regionViews[normalizeRegion(region)] ?? null : null;
}
