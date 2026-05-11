import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getConvoyByCode, getMemberByToken, publicViewForCode } from "@/lib/queries";
import ConvoyClient from "./ConvoyClient";

export const dynamic = "force-dynamic";

export default async function ConvoyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const convoy = getConvoyByCode(upper);
  if (!convoy) notFound();

  const view = publicViewForCode(upper)!;

  const cookieStore = await cookies();
  const cookieName = `convoy_${upper}`;
  const riderToken = cookieStore.get(cookieName)?.value ?? null;
  const me = riderToken ? getMemberByToken(convoy.id, riderToken) : null;

  return (
    <ConvoyClient
      initialView={view}
      initialMe={
        me
          ? { id: me.id, name: me.name, state: me.state }
          : null
      }
    />
  );
}
