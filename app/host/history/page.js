import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/utils/supabase/server";
import HostEventTable from "@/components/host/HostEventTable";

export const dynamic = "force-dynamic";

export default async function HostHistory() {
  const sb = await createSupabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login?next=/host/history");

  const { data, error } = await sb
    .from("events")
    .select("id, title, starts_at, ends_at, price_in_cents, refund_policy, rsvps(count)")
    .eq("host_id", auth.user.id)
    .order("starts_at", { ascending: false });
  if (error) throw error;

  // filter past using ends_at or starts_at
  const nowTs = Date.now();
  const pastEvents = data.filter(e=>{
    const endTs = e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime();
    return endTs < nowTs;
  });

  const ids = pastEvents.map(e=>e.id);
  let paidMap = {}, totalMap={};
  if(ids.length){
    const { data: rsvpRows } = await sb
      .from('rsvps')
      .select('event_id, paid, user_id')
      .in('event_id', ids);
    rsvpRows?.forEach(r=>{
      if(r.user_id===auth.user.id) return; // exclude host from stats
      totalMap[r.event_id]=(totalMap[r.event_id]??0)+1;
      if(r.paid) paidMap[r.event_id]=(paidMap[r.event_id]??0)+1;
    });
  }

  const rows = pastEvents.map(e=>{
    const total = totalMap[e.id]??0;
    const paid = paidMap[e.id]??0;
    const earnedCents = (e.price_in_cents||0)*paid;
    return { ...e, rsvp_count:total, paid_count:paid, unpaid_count: total-paid, earned_cents: earnedCents };
  });

  const totalEarned = rows.reduce((s,r)=>s+r.earned_cents,0);
  const totalRsvp   = rows.reduce((s,r)=>s+r.rsvp_count,0);
  const totalPaid   = rows.reduce((s,r)=>s+r.paid_count,0);
  const avgTicket   = totalPaid ? (totalEarned/totalPaid)/100 : 0;

  /* ── Repeat guest + lead-time based on most recent event ── */
  let repeatGuests = 0, totalGuests=0, pctWithin48=0;
  if(rows.length){
    const lastEvt = rows[0];
    const { data: rLast } = await sb
      .from('rsvps')
      .select('user_id, created_at')
      .eq('event_id', lastEvt.id);

    const lastUsers = rLast?.map(r=>r.user_id) || [];
    totalGuests = lastUsers.length;

    if(lastUsers.length){
      const { count } = await sb
        .from('rsvps')
        .select('user_id', { count:'exact', head:true })
        .in('user_id', lastUsers)
        .not('event_id','eq', lastEvt.id);
      repeatGuests = count || 0;

      // lead-time
      const within48 = rLast.filter(r=>{
        const diff = new Date(lastEvt.starts_at) - new Date(r.created_at);
        return diff <= 48*3600*1000;
      }).length;
      pctWithin48 = totalGuests? Math.round((within48/totalGuests)*100):0;
    }
  }

  // refunds
  let refundCents=0, refundCount=0;
  if(ids.length){
    const { data: refunds } = await sb
      .from('payments')
      .select('amount_paid')
      .eq('refunded', true)
      .in('event_id', ids);
    refunds?.forEach(r=>{ refundCount++; refundCents+=r.amount_paid; });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Past Events</h1>
      <div className="text-sm space-y-1">
        <p>Total RSVPs: {totalRsvp}</p>
        <p>Total revenue (gross): ${ (totalEarned/100).toFixed(2)}</p>
        <p>Average ticket price: ${avgTicket.toFixed(2)}</p>
        <p>Refunds issued: {refundCount} (${(refundCents/100).toFixed(2)})</p>
        {totalGuests>0 && <p>Repeat guests from prior events: {repeatGuests}</p>}
        {totalGuests>0 && <p>{pctWithin48}% of RSVPs came within 48h of the event</p>}
      </div>
      <HostEventTable events={rows} showUpcomingTab={false} initialTab="past" />
    </div>
  );
} 