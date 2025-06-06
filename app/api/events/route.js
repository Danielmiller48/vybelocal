// app/api/events/route.js

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request) {
  // Pass the cookies function directly—do NOT await it here
  const supabase = createServerComponentClient({ cookies });

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_approved', true)
    .order('date_time', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the metric
  await supabase.from('metrics').insert([
    {
      action: 'events_listed',
      user_id: null,
      event_id: null
    }
  ]);

  return NextResponse.json(events);
}
