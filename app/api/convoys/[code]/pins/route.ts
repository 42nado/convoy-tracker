import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvoyByCode, getMemberByToken, setPins } from "@/lib/queries";
import { parsePinPatchBody } from "@/lib/pins";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  const convoy = await getConvoyByCode(upper);
  if (!convoy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (convoy.status === "closed") {
    return NextResponse.json({ error: "Closed convoys can't be edited" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(`convoy_${upper}`)?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await getMemberByToken(convoy.id, token);
  if (!member || member.state !== "approved" || member.is_leader !== 1) {
    return NextResponse.json({ error: "Only the leader can pin locations" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = parsePinPatchBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await setPins(convoy.id, parsed.patch);
  return NextResponse.json({ ok: true });
}
