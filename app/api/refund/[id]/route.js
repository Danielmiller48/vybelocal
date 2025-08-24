// app/api/refund/[id]/route.js
// ----------------------------------------------------------------------------
// Attendee-initiated refund endpoint
// • URL param: id = event UUID
// • Authenticated user must have a payment for that event
// • Refund must still be within the event's refund window (can_refund)
// ----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';
import { getUserIdFromJwt } from '@/utils/auth';

export async function POST(req, { params }) {
  // 1️⃣  Route params (event ID) – accessed before any await
  const eventId = params.id;

  // 2️⃣  Verify user is logged in
  const userId = await getUserIdFromJwt(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const sb = await createSupabaseServer({ admin: true });

  // 3️⃣  Ensure refund window is open for this event
  const { data: canRefund, error: cfErr } = await sb.rpc('can_refund', { ev_id: eventId });
  if (cfErr) {
    console.error('can_refund RPC error:', cfErr);
    return NextResponse.json({ error: 'Refund check failed' }, { status: 500 });
  }
  if (!canRefund) {
    return NextResponse.json({ error: 'Refund window closed' }, { status: 400 });
  }

  // 4️⃣  Look up the payment that belongs to this user for the event
  const { data: payment, error: payErr } = await sb
    .from('payments')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('refunded', false)
    .maybeSingle();

  if (payErr) {
    return NextResponse.json({ error: payErr.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: 'No refundable payment found' }, { status: 404 });
  }

  // 5️⃣  Issue refund via Stripe and mark DB rows
  try {
    await stripe.refunds.create({ payment_intent: payment.stripe_payment_id });

    // Update payments table
    await sb.from('payments').update({ refunded: true }).eq('id', payment.id);

    // Optionally mark RSVP paid=false so seat becomes available
    if (payment.rsvp_id) {
      await sb.from('rsvps').update({ paid: false }).eq('id', payment.rsvp_id);
    }

    return NextResponse.json({ status: 'ok', message: 'Refund processed' }, { status: 200 });
  } catch (err) {
    console.error('Stripe refund error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} 