import { NextRequest, NextResponse } from "next/server";
import { publicViewForCode } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const view = await publicViewForCode(code.toUpperCase());
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}
