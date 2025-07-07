import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

// GET: List all blocks for the current user
export async function GET(request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch all blocks for this user
  const { data: blocks, error } = await supabase
    .from('blocks')
    .select('*')
    .eq('blocker_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(blocks || []);
}

// POST: Create a new block
export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { target_type, target_id } = await request.json();
  if (!target_type || !target_id) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 });
  }
  if (!['user', 'event'].includes(target_type)) {
    return NextResponse.json({ error: 'Invalid target_type' }, { status: 400 });
  }
  if (target_type === 'user' && target_id === session.user.id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  // Prevent duplicate
  const { data: existing } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', session.user.id)
    .eq('target_type', target_type)
    .eq('target_id', target_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Already blocked' }, { status: 409 });
  }

  // Insert block
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      blocker_id: session.user.id,
      target_type,
      target_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Step 1: Remove RSVPs where the blocked user has RSVPed to events hosted by the blocker
  if (target_type === 'user') {
    // Find all event IDs hosted by the blocker
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('host_id', session.user.id);
    const eventIds = (events || []).map(e => e.id);
    if (eventIds.length > 0) {
      await supabase
        .from('rsvps')
        .delete()
        .in('event_id', eventIds)
        .eq('user_id', target_id);
    }
  }

  // Step 2: Remove RSVPs where the blocker (session.user.id) has RSVPed to events hosted by the blocked user (target_id)
  if (target_type === 'user') {
    // Find all event IDs hosted by the blocked user
    const { data: blockedUserEvents } = await supabase
      .from('events')
      .select('id')
      .eq('host_id', target_id);
    const blockedUserEventIds = (blockedUserEvents || []).map(e => e.id);
    if (blockedUserEventIds.length > 0) {
      await supabase
        .from('rsvps')
        .delete()
        .in('event_id', blockedUserEventIds)
        .eq('user_id', session.user.id);
    }
  }

  return NextResponse.json(data, { status: 201 });
} 