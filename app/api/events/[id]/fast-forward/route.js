// app/api/events/[id]/fast-forward/route.js
// -----------------------------------------------------------------------------
// Development helper – immediately sets the event's ends_at to the past so
// payouts/refunds logic can run without waiting for real time to pass.
// Only enabled in non-production NODE_ENV.
// -----------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { getUserIdFromJwt } from '@/utils/auth';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(req, ctx) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  const hostId = await getUserIdFromJwt(req);
  if (!hostId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const eventId = ctx.params.id;
  const sb = await createSupabaseServer({ admin: true });

  // Verify host owns the event
  const { data: event, error: evtErr } = await sb
    .from('events')
    .select('host_id')
    .eq('id', eventId)
    .single();

  if (evtErr || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (event.host_id !== hostId) {
    return NextResponse.json({ error: 'Not your event' }, { status: 403 });
  }

  const endedAt = new Date(Date.now() - 60 * 1000).toISOString();

  const { error: updErr } = await sb
    .from('events')
    .update({ ends_at: endedAt, starts_at: endedAt })
    .eq('id', eventId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
} 