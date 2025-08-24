// ── app/user/tracked/page.jsx ──
// Tracked hosts page - shows hosts that the user is following/tracking

import { createSupabaseServer } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import TrackedHostsClient from "@/components/user/TrackedHostsClient";

export const dynamic = "force-dynamic";

export default async function TrackedHostsPage() {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  // For now, return empty array - we'll implement tracking functionality later
  // This could track hosts via a "follows" table or "tracked_hosts" table
  const trackedHosts = [];

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Tracked Hosts</h1>
        <TrackedHostsClient initialHosts={trackedHosts} />
      </div>
    </div>
  );
}