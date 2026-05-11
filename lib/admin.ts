import { NextRequest, NextResponse } from "next/server";
import { getConvoyByAdminToken } from "./queries";
import type { ConvoyRow } from "./db";

export async function withAdmin(
  ctx: { params: Promise<{ token: string }> },
  handler: (convoy: ConvoyRow, req: NextRequest) => Promise<NextResponse>,
  req: NextRequest,
): Promise<NextResponse> {
  const { token } = await ctx.params;
  const convoy = getConvoyByAdminToken(token);
  if (!convoy) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handler(convoy, req);
}

export async function readMemberId(req: NextRequest): Promise<number | null> {
  const body = (await req.json().catch(() => null)) as { memberId?: unknown } | null;
  const id = body && typeof body.memberId === "number" ? body.memberId : null;
  return id && Number.isFinite(id) ? id : null;
}
