// app/api/payments/create-intent/route.js
// Creates a Stripe PaymentIntent for an event RSVP and returns the client_secret.
// Expected POST body: { eventId: string, amount: number }
// Requires authenticated user (Checks Next-Auth session).

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';
import { calcFees } from '@/lib/fees.js';
// NEW: helper uses service role when we need to update profiles

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    let { eventId, amount } = await request.json(); // amount here is base price in cents

    // Explicitly cast amount to a Number to avoid unexpected string/NaN issues
    amount = Number(amount);

    if (!eventId || !amount || Number.isNaN(amount) || amount <= 0) {
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

    const { total, stripe: stripeFee, platform: platformFee } = calcFees(amount);

    const intentParams = {
      amount: total,
      currency: 'usd',
      customer: customerId,
      metadata: {
        eventId,              // <-- required for webhook insert
        userId: session.user.id,
        stripe_fee:  String(stripeFee),
        platform_fee: String(platformFee),
      },
      automatic_payment_methods: { enabled: true },
      setup_future_usage: 'off_session',
    };

    console.log('[create-intent] params', intentParams);

    // We are now holding funds in escrow on the PLATFORM account.
    // Hence we do NOT set transfer_data or application_fee_amount here.

    let intent;
    try {
      intent = await stripe.paymentIntents.create(intentParams);
    } catch (piErr) {
      // Handle stale customer ID (e.g., after Stripe test data wipe)
      if (piErr?.code === 'resource_missing' && piErr?.message?.includes('No such customer')) {
        console.warn('Stale stripe_customer_id detected, rebuilding customer…');
        // Create fresh customer
        const newCust = await stripe.customers.create({
          email: profile.email || session.user.email || undefined,
          metadata: { userId: session.user.id },
        });
        customerId = newCust.id;
        // Persist new ID
        await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', session.user.id);
        // Retry PaymentIntent
        intent = await stripe.paymentIntents.create({ ...intentParams, customer: customerId });
      } else {
        throw piErr;
      }
    }

    console.log('[create-intent] created PI', intent.id);

    return NextResponse.json({ client_secret: intent.client_secret });
  } catch (err) {
    console.error('Stripe create-intent error:', err);
    // Return the underlying Stripe error message in dev for easier debugging.
    // In production you might want to keep this generic.
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
} 