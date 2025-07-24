// app/api/events/[id]/penalty-intent/route.js
// Creates (or reuses) a Stripe PaymentIntent that charges the host the
// penalty + extra processing fee required to net-out the original Stripe
// refund fee on a second-strike cancellation.
// Returns: {status:'succeeded'} OR {status:'requires_action', client_secret}

import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';
import { getUserIdFromJwt } from '@/utils/auth';

// Helper – compute penalty (original Stripe fees kept on refund) and strike #
async function computeTotals(sb, eventId, hostId) {
  // Sum Stripe fees for all payments tied to this event (refunds will keep them)
  const { data: payRows } = await sb
    .from('payments')
    .select('stripe_fee_cents')
    .eq('event_id', eventId);
  const penaltyCents = payRows?.reduce((s,p)=>s+(p.stripe_fee_cents||0),0) || 0;

  // Guest RSVP count (exclude host)
  const { count: guestRsvpCount } = await sb
    .from('rsvps')
    .select('*',{count:'exact',head:true})
    .eq('event_id', eventId)
    .neq('user_id', hostId);

  // How many strikes in last 6 months (including this cancellation)
  const sixMonthsAgoIso = new Date(Date.now() - 183*24*60*60*1000).toISOString();
  const { count: strikeCnt } = await sb
    .from('host_cancel_strikes')
    .select('*',{count:'exact',head:true})
    .eq('host_id', hostId)
    .gte('canceled_at', sixMonthsAgoIso);
  const strikeNum = (strikeCnt||0) + 1; // about to insert new strike

  const willChargeHost = strikeNum >= 2 && guestRsvpCount > 0 && penaltyCents>0;
  return { penaltyCents, willChargeHost };
}

export async function POST(req, ctx){
  try{
    const hostId = await getUserIdFromJwt(req);
    if(!hostId) return new Response('unauth',{status:401});

    const eventId = ctx.params.id;

    const sb = await createSupabaseServer({ admin:true });

    const { penaltyCents, willChargeHost } = await computeTotals(sb, eventId, hostId);
    if(!willChargeHost) return new Response('no-fee',{status:400});

    // card fee constants
    const CC_RATE = 0.029;
    const CC_FIXED = 30; // cents
    const chargeCents = Math.ceil((penaltyCents + CC_FIXED) / (1 - CC_RATE));

    // fetch/create stripe customer
    const { data: prof } = await sb
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', hostId).single();
    let customerId = prof?.stripe_customer_id || null;
    if(!customerId){
      const cust = await stripe.customers.create({
        email: prof?.email || undefined,
        metadata:{ hostId }
      });
      customerId = cust.id;
      await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', hostId);
    }

    // Try off-session confirm first
    let intent;
    try{
      intent = await stripe.paymentIntents.create({
        amount: chargeCents,
        currency:'usd',
        customer: customerId,
        confirm:true,
        off_session:true,
        automatic_payment_methods:{enabled:true},
        metadata:{ type:'cancel_penalty', eventId, base_penalty_cents: penaltyCents }
      });
    }catch(err){
      if(err?.code==='authentication_required' || err?.code==='card_declined'){
        intent = await stripe.paymentIntents.retrieve(err.raw.payment_intent.id);
      }else{
        throw err;
      }
    }

    if(intent.status==='succeeded'){
      return Response.json({ status:'succeeded' });
    }
    return Response.json({ status:'requires_action', client_secret:intent.client_secret });
  }catch(err){
    console.error('penalty-intent error',err);
    return new Response('server error',{status:500});
  }
} 