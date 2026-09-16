import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin";
import { updateConvoy } from "@/lib/queries";

export const runtime = "nodejs";

interface PatchBody {
  title?: unknown;
  meetupAt?: unknown;
  meetupPlace?: unknown;
  destination?: unknown;
}

function s(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return withAdmin(
    ctx,
    async (convoy) => {
      if (convoy.status === "closed") {
        return NextResponse.json({ error: "Closed convoys can't be edited" }, { status: 400 });
      }
      const body = (await req.json().catch(() => null)) as PatchBody | null;
      if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

      const title = s(body.title, 80);
      const meetupAt = s(body.meetupAt, 40);
      const meetupPlace = s(body.meetupPlace, 120);
      const destination = s(body.destination, 120);

      if (!title || !meetupAt || !meetupPlace || !destination) {
        return NextResponse.json({ error: "All fields required" }, { status: 400 });
      }
      if (Number.isNaN(Date.parse(meetupAt))) {
        return NextResponse.json({ error: "Invalid meetup time" }, { status: 400 });
      }

      await updateConvoy(convoy.id, { title, meetupAt, meetupPlace, destination });
      return NextResponse.json({ ok: true });
    },
    req,
  );
}
