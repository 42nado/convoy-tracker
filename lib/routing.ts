import type { LatLng } from "./db";

export interface RouteResult {
  /** Polyline as [lat,lng] pairs (Leaflet-friendly). */
  points: [number, number][];
  /** Total distance in meters. */
  distance: number;
  /** Estimated duration in seconds. Null when we only have a straight line. */
  duration: number | null;
  /** True when OSRM returned an actual road-following route. */
  routed: boolean;
}

const OSRM_BASE = "https://router.project-osrm.org";

interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][]; type: "LineString" };
}

interface OsrmResponse {
  code: string;
  routes?: OsrmRoute[];
}

export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${path}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const json = (await res.json()) as OsrmResponse;
    const route = json.routes?.[0];
    if (json.code !== "Ok" || !route) throw new Error(`OSRM code=${json.code}`);
    // OSRM gives [lng,lat]; Leaflet wants [lat,lng]
    const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
    return {
      points,
      distance: route.distance,
      duration: route.duration,
      routed: true,
    };
  } catch {
    return {
      points: [
        [from.lat, from.lng],
        [to.lat, to.lng],
      ],
      distance: haversine(from, to),
      duration: null,
      routed: false,
    };
  }
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
