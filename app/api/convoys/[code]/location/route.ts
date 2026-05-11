import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getConvoyByCode,
  getMemberByToken,
  listLiveLocations,
  upsertLocation,
} from "@/lib/queries";

export const runtime = "nodejs";

interface PingBody {
  lat?: unknown;
  lng?: unknown;
  accuracy?: unknown;
  heading?: unknown;
  speed?: unknown;
}

function num(v: unknown, opts?: { min?: number; max?: number }): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (opts?.min !== undefined && v < opts.min) return null;
  if (opts?.max !== undefined && v > opts.max) return null;
  return v;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  const convoy = getConvoyByCode(upper);
  if (!convoy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (convoy.status === "closed") {
    return NextResponse.json({ error: "Convoy is closed" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(`convoy_${upper}`)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = getMemberByToken(convoy.id, token);
  if (!member || member.state !== "approved") {
    return NextResponse.json({ error: "Not an approved member" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as PingBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const lat = num(body.lat, { min: -90, max: 90 });
  const lng = num(body.lng, { min: -180, max: 180 });
  if (lat === null || lng === null) {
    return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
  }
  const accuracy = num(body.accuracy, { min: 0 });
  const heading = num(body.heading, { min: 0, max: 360 });
  const speed = num(body.speed, { min: 0 });

  upsertLocation(member.id, { lat, lng, accuracy, heading, speed });
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  const convoy = getConvoyByCode(upper);
  if (!convoy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cookieStore = await cookies();
  const token = cookieStore.get(`convoy_${upper}`)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = getMemberByToken(convoy.id, token);
  if (!member || member.state !== "approved") {
    return NextResponse.json({ error: "Not an approved member" }, { status: 403 });
  }

  return NextResponse.json({ locations: listLiveLocations(convoy.id) });
}
