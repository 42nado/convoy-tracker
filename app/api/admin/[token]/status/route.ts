import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin";
import { setConvoyStatus } from "@/lib/queries";
import type { ConvoyStatus } from "@/lib/db";

export const runtime = "nodejs";

const ALLOWED: ConvoyStatus[] = ["planned", "active", "closed"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return withAdmin(
    ctx,
    async (convoy) => {
      const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
      const status = typeof body?.status === "string" ? (body.status as ConvoyStatus) : null;
      if (!status || !ALLOWED.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (convoy.status === "closed" && status !== "closed") {
        return NextResponse.json({ error: "Closed convoys can't be reopened" }, { status: 400 });
      }
      await setConvoyStatus(convoy.id, status);
      return NextResponse.json({ ok: true });
    },
    req,
  );
}
