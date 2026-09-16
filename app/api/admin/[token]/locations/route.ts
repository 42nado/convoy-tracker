import { NextRequest, NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin";
import { listLiveLocations } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  return withAdmin(
    ctx,
    async (convoy) => NextResponse.json(
      { locations: convoy.status === "closed" ? [] : await listLiveLocations(convoy.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    ),
    req,
  );
}
