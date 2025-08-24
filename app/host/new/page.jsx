import Link from "next/link";
import HostNewForm from "@/components/host/HostNewForm";
import LockModal from "@/components/host/LockModal";
import { createSupabaseServer } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HostNewPage() {
  const sb = await createSupabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/host/new");

  // Fetch lock date
  const { data: prof } = await sb
    .from("profiles")
    .select("paid_event_lock_until")
    .eq("id", user.id)
    .maybeSingle();

  const lockUntil = prof?.paid_event_lock_until;
  const locked = lockUntil && new Date(lockUntil) > new Date();

  return (
    <div className="space-y-6">
      <Link href="/host" className="text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold">Submit a New Event</h1>

      {locked ? (
        <LockModal until={lockUntil} />
      ) : (
        <>
          {/* HostNewForm handles its own POST → /api/events */}
          <HostNewForm />
          <p className="text-sm text-gray-500">
            All new events go through moderator approval before they appear publicly.
          </p>
        </>
      )}
    </div>
  );
}