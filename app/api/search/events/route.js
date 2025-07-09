import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);

  const sb = await createSupabaseServer();
  const pattern = `%${q}%`;

  // Search by event title/description or host profile name
  const { data, error } = await sb
    .from('public_events')
    .select('id,title,starts_at,vibe,host_id,host_name,host_avatar_url')
    .or(`title.ilike.${pattern},description.ilike.${pattern},host_name.ilike.${pattern}`)
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data || []).map(r => ({
    id: r.id,
    title: r.title,
    starts_at: r.starts_at,
    vibe: r.vibe,
    host: {
      id: r.host_id,
      name: r.host_name,
      avatar_url: r.host_avatar_url,
    },
  }));

  return NextResponse.json(results);
} 