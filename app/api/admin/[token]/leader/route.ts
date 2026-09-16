import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin";
import { setLeader } from "@/lib/queries";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return withAdmin(
    ctx,
    async (convoy) => {
      const body = (await req.json().catch(() => null)) as { memberId?: unknown } | null;
      const raw = body?.memberId;
      if (raw === null) {
        await setLeader(null, convoy.id);
        return NextResponse.json({ ok: true });
      }
      const memberId = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      if (memberId === null) {
        return NextResponse.json({ error: "memberId number or null required" }, { status: 400 });
      }
      await setLeader(memberId, convoy.id);
      return NextResponse.json({ ok: true });
    },
    req,
  );
}
