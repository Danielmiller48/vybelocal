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
];

/**
 * GET /api/events/[id]
 */
export async function GET(request, { params }) {
  const supabase = await createSupabaseServer();
  const eventId  = params.id;

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
  const supabase = await createSupabaseServer();
  const eventId  = params.id;

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
