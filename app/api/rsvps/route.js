// app/api/rsvps/route.js
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request) {
  // 1) Read ?eventId= from URL
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json(
      { error: 'Missing eventId' },
      { status: 400 }
    );
  }

  // 2) Count how many RSVPs for that event
  const supabase = createServerComponentClient({ cookies });
  const { count, error } = await supabase
    .from('rsvps')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 3) Record a metric: “rsvp_counted”
  await supabase.from('metrics').insert([
    {
      action: 'rsvp_counted',
      user_id: null,
      event_id: eventId
    }
  ]);

  return NextResponse.json({ count });
}

export async function POST(request) {
  // 1) Ensure user is authenticated
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // 2) Read request body
  const body = await request.json();
  const { event_id } = body;

  // 3) Check if already RSVPed
  const { data: existing, error: existingError } = await supabase
    .from('rsvps')
    .select('*')
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

  // 4) Insert RSVP row
  const newRsvp = {
    event_id,
    user_id: session.user.id
  };
  const { data: inserted, error } = await supabase
    .from('rsvps')
    .insert([newRsvp]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const createdRsvp = inserted[0];

  // 5) Record a metric: “rsvp_added”
  await supabase.from('metrics').insert([
    {
      action: 'rsvp_added',
      user_id: session.user.id,
      event_id: event_id
    }
  ]);

  return NextResponse.json(createdRsvp, { status: 201 });
}