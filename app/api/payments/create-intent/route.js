// app/api/payments/create-intent/route.js
// -----------------------------------------------------------------------------
// Simulated payment endpoint – records a payment without hitting Stripe.
// Expected POST body: { eventId: string, amount: number }
// Requires authenticated user.
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';
import { createSupabaseServer } from '@/utils/supabase/server';
import { calcFees } from '@/lib/fees';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { eventId, amount } = await request.json();
    const amt = Number(amount);

    if (!eventId || !amt || Number.isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const sb = await createSupabaseServer({ admin: true });

    // Calculate fees (Stripe fee set to 0 during simulation)
    const { platform, total } = calcFees(amt);

    // Insert payment row
    const { data: paymentRow, error: payErr } = await sb
      .from('payments')
      .insert({
        event_id: eventId,
        user_id: session.user.id,
        stripe_payment_id: 'sim-' + crypto.randomUUID(),
        amount_paid: total,
        user_paid_cents: total,
        stripe_fee_cents: 0,
        platform_fee_cents: platform,
        receipt_url: null,
        refunded: false,
      })
      .select('*')
      .single();

    if (payErr) throw payErr;

    // Ensure RSVP (if already inserted elsewhere, ignore duplicates)
    await sb
      .from('rsvps')
      .upsert({ event_id: eventId, user_id: session.user.id, paid: true });

    // Ledger entry
    await sb.from('ledger').insert({
      payment_id: paymentRow.id,
      vybe_fee_cents: platform,
      stripe_fee_cents: 0,
      net_cents: platform,
    });

    // Send paid RSVP / payment confirmation SMS (template G)
    try {
      // Fetch event basics for copy (title and start time)
      const { data: ev } = await sb
        .from('events')
        .select('title, starts_at')
        .eq('id', eventId)
        .single();

      const starts = ev?.starts_at ? new Date(ev.starts_at) : null;
      const dateStr = starts ? starts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
      const timeStr = starts ? starts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

      // Get user phone
      const { data: prof } = await sb
        .from('profiles')
        .select('phone')
        .eq('id', session.user.id)
        .single();

      if (prof?.phone) {
        const dollars = (total / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const msg = `You’re set — ${ev?.title || 'your event'} ${dateStr} ${timeStr}; we got ${dollars} (#${paymentRow.stripe_payment_id.slice(-6)}).`;
        await fetch(`https://vybelocal.com/api/phone/send-sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: prof.phone, message: msg })
        });
      }
    } catch (smsErr) {
      console.warn('Payment SMS skipped:', smsErr?.message || smsErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('simulate create-intent error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
} 