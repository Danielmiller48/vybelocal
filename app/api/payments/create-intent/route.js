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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('simulate create-intent error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
} 