// app/api/events/[id]/cancel/route.js
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/server';
import { createSupabaseServer } from '@/utils/supabase/server';
import { getUserIdFromJwt } from '@/utils/auth';
import { evaluateCancellation } from '@/utils/ai/cancelEval';
import { sendGuestCancelEmail } from '@/utils/email.js';
import sbAdmin from '@/utils/supabase/admin';

// Helper: gather refund + penalty totals and whether fee applies
async function computeTotals(sb, eventId, hostId) {
  // 1️⃣  Check how many *guest* RSVPs exist (exclude host)
  const { count: guestRsvpCount } = await sb
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('user_id', hostId);

  // 2️⃣  Sum up unreimbursed payments (for paid events)
  const { data: payments, error: payErr } = await sb
    .from('payments')
    .select('amount_paid, stripe_fee_cents')
    .eq('event_id', eventId);
  if (payErr) throw payErr;

  const refundTotalCents = payments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);
  let stripeFeesTotal  = payments.reduce((sum, p) => sum + (p.stripe_fee_cents || 0), 0);

  console.log('[Cancel] Payments fetched:', payments.length);
  if(!payments.length){
    console.warn('[Cancel] No payment rows found for event', eventId);
  } else {
    console.log('[Cancel] Sample payment row', payments[0]);
  }

  console.log('[Cancel] raw payments', payments);

  // Fallback: if stripe_fee_cents missing (older rows) estimate 2.9%+30¢ per payment
  if (stripeFeesTotal === 0 && payments.length) {
    const CC_RATE = 0.029;
    const CC_FIXED = 30; // cents
    stripeFeesTotal = payments.reduce((sum,p)=> sum + Math.round(p.amount_paid*CC_RATE)+CC_FIXED, 0);
    console.log('[Cancel] Fallback fee estimate used', stripeFeesTotal);
  }

  console.log('[Cancel] fee totals', { refundTotalCents, stripeFeesTotal });

  // 3️⃣  Count previous cancellations in last 6 months
  const sixMonthsAgoIso = new Date(Date.now() - 183*24*60*60*1000).toISOString();
  let strikesSoFar = 0;
  try {
    const { count } = await sb
      .from('host_cancel_strikes')
      .select('*', { count:'exact', head:true })
      .eq('host_id', hostId)
      .gte('canceled_at', sixMonthsAgoIso);
    strikesSoFar = count || 0;
  } catch(err){
    if(err.code !== '42P01') throw err; // if table missing ignore
  }

  if (!strikesSoFar) {
    const { count: fallbackCnt } = await sb
      .from('events')
      .select('*', { count:'exact', head:true })
      .eq('host_id', hostId)
      .eq('status','canceled')
      .gte('canceled_at', sixMonthsAgoIso);
    strikesSoFar = fallbackCnt || 0;
  }

  const strikeNum = strikesSoFar + 1; // current cancellation number within window

  const penaltyCents   = stripeFeesTotal; // always show full stripe fees
  const willChargeHost = strikeNum >= 2 && guestRsvpCount > 0;
  let hostHistory = 0; // prior cancels within window

  hostHistory = strikeNum - 1; // prior cancels within window

  let lockDays = 0;
  if (strikeNum === 2) lockDays = 14;       // 2 weeks
  else if (strikeNum >= 3) lockDays = 60;   // 2 months

  return { refundTotalCents, penaltyCents, strikeNum, guestRsvpCount, willChargeHost, lockDays };
}

export async function GET(req, ctx) {
  const { id: eventId } = await ctx.params;
  const hostId  = await getUserIdFromJwt(req);
  if (!hostId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sb = await createSupabaseServer({ admin: true });

  // Verify event ownership
  const { data: event, error: evErr } = await sb
    .from('events')
    .select('host_id')
    .eq('id', eventId)
    .maybeSingle();

  if (evErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.host_id !== hostId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  try {
    const totals = await computeTotals(sb, eventId, hostId);
    const { data: ev } = await sb
      .from('events')
      .select('price_in_cents, starts_at, ends_at')
      .eq('id', eventId)
      .maybeSingle();

    // Consider event paid only when price_in_cents is a positive integer
    const isPaid = ev?.price_in_cents !== null && Number(ev.price_in_cents) > 0;

    // Short-notice cancellation:
    //   • Event starts within 24h (upcoming)
    //   • OR event already started but ends within 24h (ongoing)
    let shortNotice = false;
    if (ev?.starts_at) {
      const now   = Date.now();
      const start = new Date(ev.starts_at).getTime();
      const end   = ev.ends_at ? new Date(ev.ends_at).getTime() : null;

      const millis24h = 24 * 60 * 60 * 1000;

      // Upcoming soon
      if (start - now <= millis24h && start > now - 60*1000) {
        shortNotice = true;
      }

      // Ongoing and ending soon
      if (!shortNotice && end && start <= now && end - now <= millis24h && end > now - 60*1000) {
        shortNotice = true;
      }
    }
     return NextResponse.json({ ...totals, isPaidEvent: isPaid, shortNotice });
  } catch (err) {
    console.error('Cancel preview error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, ctx) {
  const { id: eventId } = await ctx.params;
  const hostId  = await getUserIdFromJwt(req);
  if (!hostId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sb = await createSupabaseServer({ admin: true });

  // Verify ownership & fetch details
  const { data: event, error: evErr } = await sb
    .from('events')
    .select('host_id, status, title, starts_at, price_in_cents')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (event.host_id !== hostId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  if (event.status === 'canceled') return NextResponse.json({ error: 'Already canceled' }, { status: 400 });

  // Compute totals
  const bodyJson = await req.json().catch(()=>({}));
  const reasonText = bodyJson.reason_text || null;
  let totals;
  try {
    totals = await computeTotals(sb, eventId, hostId);
  } catch (err) {
    console.error('Compute totals failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  // Issue refunds
  const { data: payments } = await sb
    .from('payments')
    .select('*')
    .eq('event_id', eventId)
    .eq('refunded', false);

  const results = [];
  for (const p of payments) {
    try {
      await stripe.refunds.create({ payment_intent: p.stripe_payment_id });
      await sb.from('payments').update({ refunded: true, refund_reason: 'host_canceled' }).eq('id', p.id);

      // Mark corresponding RSVP as unpaid so seat counts adjust
      if (p.rsvp_id) {
        await sb.from('rsvps').update({ paid: false }).eq('id', p.rsvp_id);
      }
      results.push({ id: p.id, status: 'ok' });
    } catch (err) {
      console.error('Refund error', err);
      results.push({ id: p.id, status: 'error', msg: err.message });
    }
  }

  // Mark event canceled
  const { error: evUpdErr } = await sb
    .from('events')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', eventId);
  if (evUpdErr) {
    console.error('Event cancel status update failed', evUpdErr);
    return NextResponse.json({ error: 'Failed to cancel event' }, { status: 500 });
  }

  // Record strike row
  const { error: strikeErr } = await sbAdmin
    .from('host_cancel_strikes')
    .insert({ host_id: hostId, event_id: eventId });
  if (strikeErr) console.error('Failed to insert strike row', strikeErr);

  // Insert AI cancellation review placeholder (reason capture TBD)
  await sbAdmin.from('ai_cancellation_reviews').insert({
    event_id: eventId,
    host_id: hostId,
    reason_text: reasonText,
    ai_strike_recommendation: totals.willChargeHost,
    confidence_score: null
  });

  // Kick off AI evaluation (non-blocking)
  const hostHistory = totals.strikeNum - 1; // number of prior cancellations in the 6-month window
  evaluateCancellation({
    reason: reasonText,
    eventInfo: `${eventId}`,
    hostHistory
  }).then(async ai => {
    await sbAdmin.from('ai_cancellation_reviews')
      .update({
        ai_strike_recommendation: ai.strike_recommendation==='yes',
        confidence_score: ai.confidence_score
      })
      .eq('event_id', eventId);
  }).catch(()=>{});

  // 🚫 Apply lock based on strike number
  if (totals.lockDays > 0) {
    const lockUntil = new Date(Date.now() + totals.lockDays * 24 * 60 * 60 * 1000).toISOString();
    await sb.from('profiles').update({ paid_event_lock_until: lockUntil }).eq('id', hostId);
    totals.lockedUntil = lockUntil;
  }

  // Penalty fee is now collected via card PaymentIntent before this PATCH is called.

  // TODO: send email receipts to attendees + host

  // Fetch host name for email
  const { data: hostProfile } = await sb
    .from('profiles')
    .select('name')
    .eq('id', hostId)
    .maybeSingle();

  // Notify guests via email (non-blocking)
  (async () => {
    // Fetch RSVPs with guest emails
    const { data: rsvps } = await sb
      .from('rsvps')
      .select('id, user_id, paid')
      .eq('event_id', eventId);

    if (rsvps?.length) {
      const userIds = rsvps.map(r => r.user_id);
      const { data: users } = await sb
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const dt = new Date(event.starts_at).toLocaleString('en-US', { dateStyle:'medium', timeStyle:'short' });

      await Promise.all(users.map(u => {
        const guestFirst = u.name?.split(' ')[0] || 'there';
        const wasPaid = !!event.price_in_cents;
        return sendGuestCancelEmail({
          to: u.email,
          guestFirst,
          eventTitle: event.title,
          eventDateTime: dt,
          hostName: hostProfile?.name || 'Host',
          wasPaid,
        });
      }));
    }
  })().catch(err => console.error('Guest email error', err));

  return NextResponse.json({ ...totals, refunded: results.length, results });
} 