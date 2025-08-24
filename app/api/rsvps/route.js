// app/api/rsvps/route.js (amended with block guards)
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function GET(request) {
  const url      = new URL(request.url);
  const eventId  = url.searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { count, error } = await supabase
    .from('rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire‑and‑forget metric
  supabase
    .from('metrics')
    .insert({ action: 'rsvp_counted', user_id: null, event_id: eventId })
    .catch(() => {});

  return NextResponse.json({ count });
}

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const session = { user };

  const { event_id } = await request.json();
  if (!event_id) {
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
  }

  // Check if the event host or the user has blocked each other
  // 1. Get the event host
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('host_id')
    .eq('id', event_id)
    .maybeSingle();
  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  const hostId = event.host_id;
  // 2. Check for blocks in either direction
  const { data: blocks } = await supabase
    .from('blocks')
    .select('id')
    .or(`(blocker_id.eq.${hostId},target_id.eq.${session.user.id}), (blocker_id.eq.${session.user.id},target_id.eq.${hostId})`);
  if (blocks && blocks.length > 0) {
    return NextResponse.json({ error: 'You cannot RSVP to this event due to a block.' }, { status: 403 });
  }

  // 1️⃣ Prevent duplicate RSVP
  const { data: existing, error: existingError } = await supabase
    .from('rsvps')
    .select('id')
    .eq('event_id', event_id)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: existingError.message },
      { status: 500 }
    );
  }
  if (existing) {
    return NextResponse.json(
      { error: 'Already RSVPed' },
      { status: 409 }
    );
  }

  // 5️⃣ Insert RSVP
  const { data: inserted, error } = await supabase
    .from('rsvps')
    .insert({ event_id, user_id: session.user.id })
    .select()
    .single();

  if (error) {
    console.error('RSVP insert error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  // 6️⃣ Metric
  supabase
    .from('metrics')
    .insert({ action: 'rsvp_added', user_id: session.user.id, event_id })
    .catch(() => {});

  return NextResponse.json(inserted, { status: 201 });
}
