import Link from 'next/link';
import { createSupabaseServer } from '@/utils/supabase/server';
import ReviewActionForm from '@/components/admin/ReviewActionForm';

export const dynamic = 'force-dynamic';

async function fetchReviews({ reviewed = false } = {}) {
  const sb = await createSupabaseServer({ admin: true });
  const { data } = await sb
    .from('ai_cancellation_reviews')
    .select(`
      id,
      reason_text,
      ai_strike_recommendation,
      confidence_score,
      created_at,
      event_id,
      host_id,
      reviewed_by,
      events!ai_cancellation_reviews_event_id_fkey(id,title,starts_at),
      profiles!ai_cancellation_reviews_host_id_fkey(id,name)
    `)
    .order('created_at', { ascending: false })
    [reviewed ? 'not' : 'is']('reviewed_by', 'is', null);
  const rows = data || [];

  // Fetch 6-month cancellation counts, total events, and revenue
  const sixMonthsAgo = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString();
  const enhancedRows = await Promise.all(rows.map(async r => {
    // cancel count (last 6 months)
    let cancelCnt = 0;
    const { data: strikeRow } = await sb
      .from('v_host_strikes_last6mo')
      .select('strike_count')
      .eq('host_id', r.host_id)
      .maybeSingle();
    cancelCnt = strikeRow?.strike_count ?? 0;

    // total events hosted (all-time)
    const { count: totalEvents } = await sb
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('host_id', r.host_id);

    // revenue to VybeLocal: sum of platform_fee_cents for non-refunded payments
    const { data: revRows } = await sb
      .from('payments')
      .select('platform_fee_cents, refunded, rsvps!inner(event_id)', { head: false })
      .eq('refunded', false)
      .eq('rsvps.event_id.host_id', r.host_id); // join through rsvps→event

    const revCents = revRows?.reduce((sum, p) => sum + (p.platform_fee_cents || 0), 0) || 0;

    return { ...r, cancelCount: cancelCnt || 0, totalEvents: totalEvents || 0, revenueCents: revCents };
  }));
  return enhancedRows;
}

export default async function AdminCancellations({ searchParams }) {
  const { status } = await searchParams;
  const reviewed = status === 'reviewed';
  const rows = await fetchReviews({ reviewed });
  return (
    <main className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Host Cancellations</h1>
      <nav className="mb-4">
        <ul className="flex space-x-4 text-sm">
          <li>
            <Link href="/admin/cancellations" className={`pb-1 ${!reviewed ? 'border-b-2 border-blue-600 font-medium' : ''}`}>Pending</Link>
          </li>
          <li>
            <Link href="/admin/cancellations?status=reviewed" className={`pb-1 ${reviewed ? 'border-b-2 border-blue-600 font-medium' : ''}`}>Reviewed</Link>
          </li>
        </ul>
      </nav>
      {rows.length === 0 && <p>No reviews yet.</p>}
      {rows.length>0 && (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2">Event</th>
              <th className="p-2">Host</th>
              <th className="p-2">AI Verdict</th>
              <th className="p-2">Reason</th>
              <th className="p-2">6-mo Cancels</th>
              <th className="p-2">Total Events</th>
              <th className="p-2">Revenue ($)</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{r.events?.title}</td>
                <td className="p-2">{r.profiles?.name}</td>
                <td className="p-2">{r.ai_strike_recommendation ? 'Strike' : 'No strike'} ({r.confidence_score?.toFixed(2)})</td>
                <td className="p-2 max-w-xs whitespace-pre-line break-words">{r.reason_text}</td>
                <td className="p-2 text-center">{r.cancelCount}</td>
                <td className="p-2 text-center">{r.totalEvents}</td>
                <td className="p-2 text-right">{(r.revenueCents/100).toFixed(2)}</td>
                <td className="p-2 space-x-2">
                  <ReviewActionForm reviewId={r.id} action="approve" label="Approve" colorClass="bg-green-600" />
                  <ReviewActionForm reviewId={r.id} action="strike" label="Apply Strike" colorClass="bg-red-600" />
                  <ReviewActionForm reviewId={r.id} action="flag" label="Flag" colorClass="bg-yellow-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
} 