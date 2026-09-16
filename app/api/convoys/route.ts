import { NextRequest, NextResponse } from "next/server";
import { createConvoy } from "@/lib/queries";
import { parsePinPatchBody, type PinPatch } from "@/lib/pins";

export const runtime = "nodejs";

interface CreateBody {
  title?: unknown;
  meetupAt?: unknown;
  meetupPlace?: unknown;
  destination?: unknown;
  pins?: unknown;
}

function s(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const title = s(body.title, 80);
  const meetupAt = s(body.meetupAt, 40);
  const meetupPlace = s(body.meetupPlace, 120);
  const destination = s(body.destination, 120);

  if (!title || !meetupAt || !meetupPlace || !destination) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (Number.isNaN(Date.parse(meetupAt))) {
    return NextResponse.json({ error: "Invalid meetup time" }, { status: 400 });
  }

  let pins: PinPatch = {};
  if (body.pins !== undefined) {
    const parsed = parsePinPatchBody(body.pins);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    pins = parsed.patch;
  }

  const convoy = await createConvoy({ title, meetupAt, meetupPlace, destination, pins });
  const origin = req.nextUrl.origin;

  return NextResponse.json({
    code: convoy.code,
    adminToken: convoy.admin_token,
    joinUrl: `${origin}/c/${convoy.code}`,
    adminUrl: `${origin}/admin/${convoy.admin_token}`,
  });
}
