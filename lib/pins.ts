import type { LatLng } from "./db";

type PinValue = LatLng | null | undefined;

export interface PinPatch {
  meetup?: LatLng | null;
  destination?: LatLng | null;
}

function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const { lat, lng } = v as Record<string, unknown>;
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

function parsePin(raw: unknown): { ok: true; value: PinValue } | { ok: false; error: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (isLatLng(raw)) return { ok: true, value: raw };
  return { ok: false, error: "Pin must be {lat,lng} with lat∈[-90,90] and lng∈[-180,180], or null to clear" };
}

export function parsePinPatchBody(body: unknown): { ok: true; patch: PinPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid JSON body" };
  const b = body as Record<string, unknown>;
  const meetup = parsePin(b.meetup);
  if (!meetup.ok) return meetup;
  const destination = parsePin(b.destination);
  if (!destination.ok) return destination;
  const patch: PinPatch = {};
  if (meetup.value !== undefined) patch.meetup = meetup.value;
  if (destination.value !== undefined) patch.destination = destination.value;
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Provide at least one of `meetup` or `destination`" };
  }
  return { ok: true, patch };
}
