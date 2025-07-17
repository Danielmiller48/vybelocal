// app/api/host/events/route.js
import { NextResponse } from 'next/server';
import sbAdmin from '@/utils/supabase/admin';
import { getUserIdFromJwt } from '@/utils/auth';

export async function GET(req) {
  const url = new URL(req.url);
  const search = url.searchParams;

  const hostId = await getUserIdFromJwt(req);
  if (!hostId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const range  = search.get('range')  ?? 'upcoming'; // upcoming | past
  const cursor = search.get('cursor');               // ISO timestamp of last row when paginating past
  const limit  = 20;

  let q = sbAdmin
    .from('events')
    .select(`*, rsvps(count)`)
    .eq('host_id', hostId);

  if (range === 'upcoming') {
    q = q.gte('starts_at', sbAdmin.rpc('now'))
         .order('starts_at', { ascending: true });
  } else {
    q = q.lt('starts_at', sbAdmin.rpc('now'))
         .order('starts_at', { ascending: false })
         .limit(limit);
    if (cursor) q = q.lt('starts_at', cursor);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let next_cursor = null;
  if (range === 'past' && data.length === limit) {
    next_cursor = data[data.length - 1].starts_at;
  }

  /* augment with paid/unpaid and earnings */
  const ids = data.map(e=>e.id);
  let paidCounts = {};
  if(ids.length){
    const { data: payRows } = await sbAdmin
      .from('payments')
      .select('event_id')
      .eq('refunded', false)
      .in('event_id', ids);
    payRows?.forEach(r=>{ paidCounts[r.event_id]=(paidCounts[r.event_id]??0)+1; });
  }

  const enriched = data.map(e=>{
    const total = e.rsvps?.[0]?.count ?? 0;
    const paid  = paidCounts[e.id] ?? 0;
    const unpaid= total - paid;
    const earnings_cents = (e.price_in_cents || 0) * paid;
    return { ...e, paid_count: paid, unpaid_count: unpaid, expected_payout_cents: earnings_cents };
  });

  return NextResponse.json({ data: enriched, next_cursor });
}