export interface Point {
  lat: number;
  lng: number;
}

// Parcarea flotei: toate mașinile pornesc și se întorc aici.
export const ORADEA_PARKING: Point = { lat: 47.0465, lng: 21.9189 };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Distanța în linie dreaptă (formula haversine).
export function distanceKm(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Avansează stepKm în linie dreaptă spre destinație; la final se oprește exact pe ea.
export function stepToward(from: Point, to: Point, stepKm: number): Point & { arrived: boolean } {
  const remaining = distanceKm(from, to);
  if (remaining <= stepKm) {
    return { ...to, arrived: true };
  }
  const fraction = stepKm / remaining;
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
    arrived: false,
  };
}
