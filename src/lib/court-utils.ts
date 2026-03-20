const UCL_LAT = 51.5246;
const UCL_LNG = -0.134;

export interface CourtMeta {
  lat?: number;
  lng?: number;
  courts?: number;
  surface?: string;
  floodlit?: boolean;
  pricing?: Record<string, string>;
  note?: string;
  venue?: string;
  deepLink?: string;
  [key: string]: unknown;
}

export function parseCourtMeta(metadata: unknown): CourtMeta {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as CourtMeta;
}

export function distanceFromUCL(lat: number, lng: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat - UCL_LAT) * Math.PI) / 180;
  const dLng = ((lng - UCL_LNG) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((UCL_LAT * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(miles: number): string {
  return `${miles.toFixed(1)} mi`;
}
