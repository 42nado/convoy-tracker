import { notFound } from "next/navigation";
import { adminViewForToken } from "@/lib/queries";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await adminViewForToken(token);
  if (!view) notFound();
  return <AdminClient initialView={view} />;
}
