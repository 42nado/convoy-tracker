import { NextRequest, NextResponse } from "next/server";
import { adminViewForToken } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const view = await adminViewForToken(token);
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(view);
}
