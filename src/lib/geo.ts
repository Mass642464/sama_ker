export type GeoPoint = { lat: number; lng: number };
export type MapBounds = { north: number; south: number; east: number; west: number };

export function isInMapBounds(point: GeoPoint, bounds: MapBounds) {
  const longitudeInBounds = bounds.west <= bounds.east
    ? point.lng >= bounds.west && point.lng <= bounds.east
    : point.lng >= bounds.west || point.lng <= bounds.east;
  return point.lat >= bounds.south && point.lat <= bounds.north && longitudeInBounds;
}

const earthRadiusKm = 6371;

export function distanceKm(from: GeoPoint, to: GeoPoint) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Les positions publiées sont arrondies à environ 1 km : on n'affiche donc qu'une distance approximative.
export function formatApproximateDistance(km: number) {
  if (km < 2) return "moins de 2 km";
  if (km < 10) return `environ ${Math.round(km)} km`;
  return `environ ${Math.round(km / 5) * 5} km`;
}

export function sortByDistance<T extends { coordinates?: GeoPoint }>(items: T[], origin: GeoPoint): Array<T & { distanceKm: number | null }> {
  return items
    .map((item) => ({ ...item, distanceKm: item.coordinates ? distanceKm(origin, item.coordinates) : null }))
    .sort((left, right) => {
      if (left.distanceKm === null && right.distanceKm === null) return 0;
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm;
    });
}
