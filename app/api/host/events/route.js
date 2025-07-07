// app/api/host/events/route.js
import { NextResponse } from 'next/server';
import sbAdmin from '@/utils/supabase/admin';
import { getUserIdFromJwt } from '@/utils/auth';

export async function GET(req) {
  // 1️⃣ identify the current host
  const hostId = await getUserIdFromJwt(req);

  if (!hostId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // 2️⃣ query events with RSVP counts
  const { data, error } = await sbAdmin
    .from('events')
    .select(`
      *,
      rsvps(count)
    `)
    .eq('host_id', hostId)
    .order('starts_at', { ascending: false });

  // 3️⃣ error handling
  if (error) {
    console.error('Host events fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 4️⃣ return the list
  return NextResponse.json(data);
}