import { NextRequest, NextResponse } from "next/server";
import { withAdmin, readMemberId } from "@/lib/admin";
import { setMemberState } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return withAdmin(
    ctx,
    async (convoy) => {
      const memberId = await readMemberId(req);
      if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });
      setMemberState(memberId, convoy.id, "denied");
      return NextResponse.json({ ok: true });
    },
    req,
  );
}
