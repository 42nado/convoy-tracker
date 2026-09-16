import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvoyByCode, getMemberByToken, setMemberState } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  const convoy = await getConvoyByCode(upper);
  if (!convoy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cookieName = `convoy_${upper}`;
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return NextResponse.json({ ok: true });

  const m = await getMemberByToken(convoy.id, token);
  if (m) await setMemberState(m.id, convoy.id, "left");

  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: cookieName, value: "", path: "/", maxAge: 0 });
  return res;
}
