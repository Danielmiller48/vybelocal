import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/utils/supabase/server";
import HostMetricsCards from "@/components/host/HostMetricsCards";
import HostEventTable from "@/components/host/HostEventTable";

export const dynamic = "force-dynamic";

export default async function HostDashboard() {
  const sb = await createSupabaseServer();

  /* ── who's logged in? ─────────────────────── */
  const {
    data: auth,
    error: authErr,
  } = await sb.auth.getUser();

  // if the cookie's missing or the token is bad → bounce to login
  if (authErr || !auth?.user) redirect("/login?next=/host");

  const user = auth.user;

  /* ── pull events + RSVP counts ────────────── */
  const { data: events, error } = await sb
    .from("events")
    .select("id, title, status, starts_at, ends_at, rsvps(count)")
    .eq("host_id", user.id)
    .order("starts_at", { ascending: false });

  if (error) throw error;

  /* ── flatten RSVP counts ──────────────────── */
  const eventsWithCount = events.map((e) => ({
    ...e,
    rsvp_count: e.rsvps?.[0]?.count ?? 0,
  }));

  /* ── compute metrics ──────────────────────── */
  const totalRsvps = eventsWithCount.reduce(
    (sum, e) => sum + e.rsvp_count,
    0
  );

   /* gather today's RSVPs (UTC) */
  let rsvpsToday = 0;
  const eventIds = eventsWithCount.map((e) => e.id).filter(Boolean);

  if (eventIds.length) {
    const { count: todayCount, error: todayErr } = await sb
      .from("rsvps")
      .select("*", { count: "exact", head: true })
      .in("event_id", eventIds)
      .gte("created_at", new Date().toISOString().slice(0, 10)); // midnight UTC

    if (todayErr) throw todayErr;
    rsvpsToday = todayCount ?? 0;
  }

  /* ── pass down to components ──────────────── */
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Host Dashboard</h1>

      <HostMetricsCards totals={{ total: totalRsvps, today: rsvpsToday }} />

      <HostEventTable events={eventsWithCount} />
    </div>
  );
}
