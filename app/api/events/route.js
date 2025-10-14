import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/utils/supabase/server";

/* GET /api/events — approved only */
export async function GET() {
  const sb = await createSupabaseServer();
  const { data, error } = await sb
    .from("events")
    .select("*")
    .eq("status", "approved")
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/* POST /api/events — new submission (status = "pending") */
export async function POST(req) {
  const sb = await createSupabaseServer();

  /* 1 — auth gate */
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const session = { user };

  /* 2 — parse + minimal validation */
  const body = await req.json();
  for (const k of ["title", "vibe", "starts_at"]) {
    if (!body?.[k])
      return NextResponse.json({ error: `Missing "${k}"` }, { status: 400 });
  }

  /* 2.5 — enforce KYB active before allowing paid events */
  try {
    const { data: prof } = await sb
      .from('profiles')
      .select('tilled_status, tilled_required')
      .eq('id', user.id)
      .maybeSingle();

    const status = (prof?.tilled_status || '').toLowerCase();
    const wantsPaid = Number.isFinite(body?.price_in_cents) && Number(body.price_in_cents) > 0;
    if (wantsPaid && status !== 'active') {
      return NextResponse.json({
        code: 'kyb_not_active',
        error: 'Paid events are locked until your payouts are verified.',
        tilled_status: status || null,
        required: prof?.tilled_required || null,
      }, { status: 403 });
    }
  } catch {
    // If profile lookup fails, default to blocking paid to be safe
    const wantsPaid = Number.isFinite(body?.price_in_cents) && Number(body.price_in_cents) > 0;
    if (wantsPaid) {
      return NextResponse.json({
        code: 'kyb_not_active',
        error: 'Paid events are locked until your payouts are verified.',
        tilled_status: null,
        required: null,
      }, { status: 403 });
    }
  }

  /* 3 — whitelist to real columns only */
  const event = {
    host_id: session.user.id,
    title: body.title,
    description: body.description ?? "",
    vibe: String(body.vibe).toLowerCase(),
    address: body.address ?? "",
    starts_at: body.starts_at,
    ends_at: body.ends_at || null,
    refund_policy: body.refund_policy ?? "no_refund",
    price_in_cents: Number.isFinite(body.price_in_cents) ? body.price_in_cents : null,
    rsvp_capacity: Number.isFinite(body.rsvp_capacity) ? body.rsvp_capacity : null,
    // Add +1 so host's auto-RSVP doesn't reduce the advertised guest capacity
    ...(Number.isFinite(body.rsvp_capacity) ? { rsvp_capacity: body.rsvp_capacity + 1 } : {}),
    status: "pending",
    img_path: body.img_path || null,
  };

  /* 4 — insert */
  const { data, error } = await sb
    .from("events")
    .insert([event])
    .select()
    .single(); // just one row expected

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  /* 4.5 — auto-RSVP host (counts toward capacity) */
  try {
    await sb.from('rsvps')
      .insert({
        event_id: data.id,
        user_id: session.user.id,
        paid: event.price_in_cents ? true : false, // host considered paid
      }, { ignoreDuplicates: true });
  } catch (rsvpErr) {
    console.error('Auto-RSVP insert failed:', rsvpErr);
  }

  /* 5 — trigger moderation */
  try {
    console.log('Triggering moderation for new event:', data.id);
    const origin = process.env.NEXTAUTH_URL 
      || process.env.NEXT_PUBLIC_SITE_URL 
      || (req?.headers?.get?.('origin'))
      || (`${req?.headers?.get?.('x-forwarded-proto') || 'https'}://${req?.headers?.get?.('host')}`);
    const base = origin && origin.startsWith('http') ? origin : `https://${origin}`;
    const modUrl = `${base}/api/moderate`;
    const modResponse = await fetch(modUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'event', id: data.id }),
    });
    const modText = await modResponse.text();
    let modJson = {}; try { modJson = JSON.parse(modText); } catch {}
    console.log('Moderation response', { url: modUrl, status: modResponse.status, ok: modResponse.ok, body: (modText||'').slice(0,300) });

    if (!modResponse.ok) {
      const modError = modJson || { reason: modText };
      console.error('Moderation failed:', { status: modResponse.status, modError });
      
      // Delete the event since moderation failed
      await sb.from("events").delete().eq('id', data.id);
      
      // Return the moderation error to the frontend
      return NextResponse.json({ 
        error: modError.reason || modError.error || 'Content moderation failed',
        moderationError: true 
      }, { status: 400 });
    } else {
      console.log('Moderation triggered successfully');
    }
  } catch (modError) {
    console.error('Moderation error:', modError);
    
    // Delete the event since moderation failed
    await sb.from("events").delete().eq('id', data.id);
    
    // Return the moderation error to the frontend
    return NextResponse.json({ 
      error: 'Content moderation failed - please try again',
      moderationError: true,
      detail: modError?.message || String(modError)
    }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
