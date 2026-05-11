import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvoyByCode, getMemberByToken } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const upper = code.toUpperCase();
  const convoy = getConvoyByCode(upper);
  if (!convoy) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cookieStore = await cookies();
  const token = cookieStore.get(`convoy_${upper}`)?.value;
  if (!token) return NextResponse.json({ member: null });

  const m = getMemberByToken(convoy.id, token);
  if (!m) return NextResponse.json({ member: null });
  return NextResponse.json({ member: { id: m.id, name: m.name, state: m.state } });
}
