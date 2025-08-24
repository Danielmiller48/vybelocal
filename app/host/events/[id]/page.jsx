import HostEditForm from "@/components/host/HostEditForm";
import Link from "next/link";
import { createSupabaseServer } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function HostEventEditPage({ params }) {
  const sb = await createSupabaseServer();

  /* 0 ─ session */
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) {
    return <div className="p-8 text-red-600">Not authenticated</div>;
  }

  /* 1 ─ fetch event */
  const { data: event, error } = await sb
    .from("events")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !event) {
    return <div className="p-8 text-red-600">Event not found</div>;
  }

  if (event.host_id !== session.user.id) {
    return <div className="p-8 text-red-600">Not your event</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/host" className="text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold">Edit Event</h1>

      <HostEditForm event={event} />
    </div>
  );
}
