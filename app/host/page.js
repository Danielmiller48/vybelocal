import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/utils/supabase/server";
import HostMetricsCards from "@/components/host/HostMetricsCards";
import HostEventTable from "@/components/host/HostEventTable";
import HostNextEventCard from "@/components/host/HostNextEventCard";

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

  /* ── fetch events w/ nested RSVP counts ────────────── */
  const { data: events, error } = await sb
    .from("events")
    .select("id, title, status, starts_at, ends_at, vibe, refund_policy, price_in_cents, rsvps(count)")
    .eq("host_id", user.id)
    .order("starts_at", { ascending: false });

  if (error) throw error;

  const paidEventIds = events.map(e=>e.id);

  let paidMap = {}, totalMap = {};
  if(paidEventIds.length){
    const { data: rsvpRows } = await sb
      .from('rsvps')
      .select('event_id, paid')
      .in('event_id', paidEventIds);

    rsvpRows?.forEach(r=>{
      totalMap[r.event_id] = (totalMap[r.event_id] ?? 0) + 1;
      if(r.paid) paidMap[r.event_id] = (paidMap[r.event_id] ?? 0) + 1;
    });
  }

  const eventsWithCount = events.map((e) => {
    const total = totalMap[e.id] ?? 0;
    const paid  = paidMap[e.id] ?? 0;
    const unpaid= Math.max(0, total - paid);
    const earningsCents = (e.price_in_cents || 0) * paid;
    return {
      ...e,
      paid_count: paid,
      unpaid_count: unpaid,
      rsvp_count: total,
      expected_payout_cents: earningsCents,
    };
  });

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

  /* next upcoming event */
  const nextEvent = eventsWithCount.find(e => new Date(e.starts_at) >= Date.now() - 60*60*1000);
  let expectedPayout = 0;
  if (nextEvent && nextEvent.price_in_cents) {
    expectedPayout = (nextEvent.price_in_cents * nextEvent.paid_count) / 100;
  }

  /* ── Insights for current month ───────────── */
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth()+1, 1).toISOString();

  let monthEarnCents = 0;
  if(eventIds.length){
    const { data: monthPay } = await sb
      .from('payments')
      .select('amount_paid')
      .eq('refunded', false)
      .gte('paid_at', monthStart)
      .lt('paid_at', monthEnd)
      .in('event_id', eventIds);
    monthPay?.forEach(p=>{ monthEarnCents += p.amount_paid; });
  }

  const monthEvents = eventsWithCount.filter(e=> e.starts_at >= monthStart && e.starts_at < monthEnd);
  const topEvent    = monthEvents.sort((a,b)=>b.rsvp_count - a.rsvp_count)[0];

  /* ── pass down to components ──────────────── */
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Host Dashboard</h1>

      <HostNextEventCard
        event={nextEvent}
        paidCount={nextEvent?.paid_count ?? 0}
        unpaidCount={nextEvent?.unpaid_count ?? 0}
        expectedPayout={expectedPayout}
      />

      <HostMetricsCards totals={{ total: totalRsvps, today: rsvpsToday }} />

      {/* Insights */}
      <div className="bg-white rounded shadow p-4 space-y-1 text-sm">
        <h2 className="font-medium mb-2">This Month</h2>
        <p>Revenue: ${ (monthEarnCents/100).toFixed(2)}</p>
        {topEvent && (<p>Top event: <span className="font-medium">{topEvent.title}</span> ({topEvent.rsvp_count} RSVPs)</p>)}
      </div>

      <HostEventTable events={eventsWithCount} showPastTab={false} />
    </div>
  );
}
