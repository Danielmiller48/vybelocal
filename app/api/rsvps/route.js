// app/api/rsvps/route.js — fully patched
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

/**
 * GET /api/rsvps?eventId=…
 * Returns the RSVP count for a single event.
 */
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

/**
 * POST /api/rsvps
 * Body: { event_id }
 * Creates an RSVP row for the authenticated user.
 */
export async function POST(request) {
  const supabase = await createSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { event_id } = await request.json();
  if (!event_id) {
    return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });
  }

  // 1) Prevent duplicate RSVP
  const { data: existing, error: existingError } = await supabase
    .from('rsvps')
    .select('id')
    .eq('event_id', event_id)
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ error: 'Already RSVPed' }, { status: 409 });
  }

  // 2) Insert
  const { data: inserted, error } = await supabase
    .from('rsvps')
    .insert({ event_id, user_id: session.user.id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3) Metric
  supabase
    .from('metrics')
    .insert({ action: 'rsvp_added', user_id: session.user.id, event_id })
    .catch(() => {});

  return NextResponse.json(inserted, { status: 201 });
}
