// app/api/events/[id]/route.js
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request, { params }) {
  const supabase = createServerComponentClient({ cookies });
  const eventId = params.id;

  // 1) Fetch the event row (if it exists)
  const {
    data: [event],
    error
  } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // 2) Check if it’s approved, or if the requester is the host
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!event.is_approved && session?.user.id !== event.host_id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // 3) Record a metric: “event_viewed”
  await supabase.from('metrics').insert([
    {
      action: 'event_viewed',
      user_id: session?.user.id || null,
      event_id: eventId
    }
  ]);

  return NextResponse.json(event);
}

export async function PATCH(request, { params }) {
  const supabase = createServerComponentClient({ cookies });
  const eventId = params.id;

  // 1) Ensure user is authenticated
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // 2) Read request body (could be { is_approved: true } or other fields)
  const body = await request.json();

  // 3) If updating is_approved, check admin
  if (body.hasOwnProperty('is_approved')) {
    // Fetch user’s profile to check is_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: 'Admin only' },
        { status: 403 }
      );
    }
  }

  // 4) Perform the update (RLS will enforce host-only updates on other fields)
  const { data: updatedEvents, error } = await supabase
    .from('events')
    .update(body)
    .eq('id', eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedEvent = updatedEvents[0];

  // 5) If is_approved was toggled to true, record “event_approved”
  if (body.is_approved === true) {
    await supabase.from('metrics').insert([
      {
        action: 'event_approved',
        user_id: session.user.id,
        event_id: eventId
      }
    ]);
  }

  return NextResponse.json(updatedEvent);
}