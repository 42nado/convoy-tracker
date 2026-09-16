import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin";
import { setPins } from "@/lib/queries";
import { parsePinPatchBody } from "@/lib/pins";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return withAdmin(
    ctx,
    async (convoy) => {
      if (convoy.status === "closed") {
        return NextResponse.json({ error: "Closed convoys can't be edited" }, { status: 400 });
      }
      const body = await req.json().catch(() => null);
      const parsed = parsePinPatchBody(body);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      await setPins(convoy.id, parsed.patch);
      return NextResponse.json({ ok: true });
    },
    req,
  );
}
