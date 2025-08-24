// app/api/events/[id]/route.js — schema‑aligned GET + PATCH
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

// Only these fields may be updated by PATCH
const EDITABLE = [
  'title',
  'description',
  'vibe',
  'address',
  'starts_at',
  'ends_at',
  'status',
  'img_path',
  'price_in_cents',
  'refund_policy',
  'rsvp_capacity',
];

/**
 * GET /api/events/[id]
 */
export async function GET(request, { params }) {
  const eventId = params.id;
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/events/[id]
 * Requires user to be host of the event or admin.
 */
export async function PATCH(request, { params }) {
  const eventId = params.id;
  const supabase = await createSupabaseServer();

  const bodyRaw = await request.json();
  const body    = Object.fromEntries(
    Object.entries(bodyRaw).filter(([k]) => EDITABLE.includes(k))
  );

  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('host_id')
    .eq('id', eventId)
    .maybeSingle();
  if (fetchError || !event) {
    return NextResponse.json({ error: fetchError?.message || 'Not found' }, { status: 404 });
  }

  // Simple auth check: only the host or admin may edit
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.id !== event.host_id && user.role !== 'authenticated')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('events')
    .update(body)
    .eq('id', eventId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/events/[id]
 * Requires user to be host of the event or admin.
 */
export async function DELETE(request, { params }) {
  const eventId = params.id;
  const supabase = await createSupabaseServer();

  // Check if event exists and get host_id
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select('host_id, title')
    .eq('id', eventId)
    .maybeSingle();
  
  if (fetchError || !event) {
    return NextResponse.json({ error: fetchError?.message || 'Event not found' }, { status: 404 });
  }

  // Auth check: only the host or admin may delete
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || (user.id !== event.host_id && user.role !== 'authenticated')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Delete associated RSVPs first (due to foreign key constraints)
  const { error: rsvpError } = await supabase
    .from('rsvps')
    .delete()
    .eq('event_id', eventId);

  if (rsvpError) {
    console.error('Error deleting RSVPs:', rsvpError);
    return NextResponse.json({ error: 'Failed to delete event RSVPs' }, { status: 500 });
  }

  // Delete the event
  const { error: deleteError } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);

  if (deleteError) {
    console.error('Error deleting event:', deleteError);
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
  }

  console.log(`Event "${event.title}" (${eventId}) deleted by user ${user.id}`);
  return NextResponse.json({ success: true, message: 'Event deleted successfully' });
}
