// app/api/host/refund/[id]/route.js
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';
import { getUserIdFromJwt } from '@/utils/auth';

export async function POST(req, { params }) {
  const hostId = await getUserIdFromJwt(req);
  if (!hostId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const eventId = params.id;
  const sb = await createSupabaseServer({ admin: true });

  // Verify host owns the event and refund window open
  const { data: event, error: evErr } = await sb
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (evErr || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.host_id !== hostId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data: canRefund, error: cfErr } = await sb.rpc('can_refund', { ev_id: eventId });
  if (cfErr) {
    console.error('can_refund error', cfErr);
    return NextResponse.json({ error: 'Refund check failed' }, { status: 500 });
  }
  if (!canRefund) {
    return NextResponse.json({ error: 'Refund window closed' }, { status: 400 });
  }

  // Fetch payments to refund
  const { data: payments, error: payErr } = await sb
    .from('payments')
    .select('*')
    .eq('event_id', eventId)
    .eq('refunded', false);

  if (payErr) {
    return NextResponse.json({ error: payErr.message }, { status: 500 });
  }

  const results = [];
  for (const p of payments) {
    try {
      await stripe.refunds.create({ payment_intent: p.stripe_payment_id });
      await sb.from('payments').update({ refunded: true }).eq('id', p.id);
      results.push({ payment: p.id, status: 'ok' });
    } catch (err) {
      console.error('Refund error:', err);
      results.push({ payment: p.id, status: 'error', message: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
} 