import { getCloudflareContext } from "@opennextjs/cloudflare";

export function db(): D1Database {
  return getCloudflareContext().env.DB;
}

export type ConvoyStatus = "planned" | "active" | "closed";
export type MemberState = "pending" | "approved" | "denied" | "left";

export interface ConvoyRow {
  id: number;
  code: string;
  admin_token: string;
  title: string;
  meetup_at: string;
  meetup_place: string;
  destination: string;
  meetup_lat: number | null;
  meetup_lng: number | null;
  dest_lat: number | null;
  dest_lng: number | null;
  status: ConvoyStatus;
  created_at: string;
  closed_at: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MemberRow {
  id: number;
  convoy_id: number;
  name: string;
  token: string;
  state: MemberState;
  is_leader: number;
  created_at: string;
}

export interface LocationRow {
  member_id: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}
