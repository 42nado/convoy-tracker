import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvoyByCode, getMemberByToken, requestJoin } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  const convoy = await getConvoyByCode(upper);
  if (!convoy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (convoy.status === "closed") {
    return NextResponse.json({ error: "This convoy is closed" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const raw = typeof body?.name === "string" ? body.name.trim() : "";
  if (!raw || raw.length > 40) {
    return NextResponse.json({ error: "Name is required (max 40 chars)" }, { status: 400 });
  }

  const cookieName = `convoy_${upper}`;
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(cookieName)?.value;
  if (existingToken) {
    const existing = await getMemberByToken(convoy.id, existingToken);
    if (existing) {
      return NextResponse.json({
        member: { id: existing.id, name: existing.name, state: existing.state },
      });
    }
  }

  const member = await requestJoin(convoy.id, raw);

  const res = NextResponse.json({
    member: { id: member.id, name: member.name, state: member.state },
  });
  res.cookies.set({
    name: cookieName,
    value: member.token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
