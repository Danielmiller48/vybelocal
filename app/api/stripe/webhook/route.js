// app/api/stripe/webhook/route.js
// -----------------------------------------------------------------------------
// Stripe webhook endpoint – listens for payment_intent.succeeded (and future events)
// Docs: https://stripe.com/docs/webhooks
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';

// Disable Next.js body parsing so we can verify the raw signature
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to collect raw buffer from the request
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function POST(request) {
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return new Response('Webhook misconfigured', { status: 500 });
  }

  let event;
  try {
    const rawBody = await buffer(request.body);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log('[webhook] received:', event.type);

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    console.log('[webhook] intent id', intent.id);
    console.log('[webhook] metadata', intent.metadata);
    try {
      const { metadata, amount_received, charges, id: intentId } = intent;
      const eventId = metadata.eventId;
      const userId  = metadata.userId;
      const receiptUrl = charges?.data?.[0]?.receipt_url || null;

      if (!eventId || !userId) {
        throw new Error('Missing metadata on PaymentIntent');
      }

      const sb = await createSupabaseServer({ admin: true });

      // 1️⃣ Insert into payments (ignore duplicates if Stripe retries)
      const { data: paymentRow, error: payErr } = await sb.from('payments')
        .upsert({
          event_id:          eventId,
          user_id:           userId,
          stripe_payment_id: intentId,
          amount_paid:       amount_received,
          user_paid_cents:   amount_received,
          stripe_fee_cents:  Number(metadata.stripe_fee || 0),
          platform_fee_cents: Number(metadata.platform_fee || 0),
          receipt_url:       receiptUrl,
          refunded:          false,
        })
        .select('*')
        .single();

      console.log('[webhook] insert result', { paymentRow, payErr });

      if (payErr) throw payErr;

      // 1.5 – Ledger entry (platform revenue breakdown)
      const vybeFee   = Number(metadata.platform_fee || 0);
      const stripeFee = Number(metadata.stripe_fee   || 0);
      const net       = vybeFee; // After user-covers-stripe-fee model, net == vybeFee

      await sb.from('ledger').upsert({
        payment_id:       paymentRow.id,
        vybe_fee_cents:   vybeFee,
        stripe_fee_cents: stripeFee,
        net_cents:        net,
      });

      // 2️⃣ Mark RSVP row as paid
      await sb
        .from('rsvps')
        .update({ paid: true })
        .eq('event_id', eventId)
        .eq('user_id', userId);

      console.log(`Payment recorded for RSVP (${eventId}, ${userId})`);
    } catch (err) {
      console.error('Webhook handling error:', err);
      return new Response('Webhook handler error', { status: 500 });
    }
  }

  // Return 200 to acknowledge receipt
  return NextResponse.json({ received: true });
} 