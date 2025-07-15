// app/api/payments/create-intent/route.js
// Creates a Stripe PaymentIntent for an event RSVP and returns the client_secret.
// Expected POST body: { eventId: string, amount: number }
// Requires authenticated user (Checks Next-Auth session).

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';
// NEW: helper uses service role when we need to update profiles

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { eventId, amount } = await request.json();
    if (!eventId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 1: Ensure the user has a Stripe Customer for faster checkout.
    // We store the customer ID in the **profiles** table.
    // ──────────────────────────────────────────────────────────────

    const sb = await createSupabaseServer({ admin: true }); // service role to bypass RLS for profile update

    let { data: profile, error: pErr } = await sb
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', session.user.id)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || session.user.email || undefined,
        metadata: { userId: session.user.id },
      });
      customerId = customer.id;

      // Save it back for next time (ignore result errors for resiliency)
      await sb
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', session.user.id);
    }

    // ──────────────────────────────────────────────────────────────
    // STEP 2: Create PaymentIntent linked to that customer.
    // ──────────────────────────────────────────────────────────────

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      metadata: {
        eventId,
        userId: session.user.id,
      },
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session', // allows saving card for next time
    });

    return NextResponse.json({ client_secret: intent.client_secret });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 