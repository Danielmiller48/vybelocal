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
    .from('events')
    .select(
      'id,title,starts_at,vibe, profiles!events_host_id_fkey(id,name,avatar_url)'
    )
    .eq('status', 'approved')
    .or(
      `title.ilike.${pattern},description.ilike.${pattern},profiles.name.ilike.${pattern}`
    )
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Shape result
  const results = (data || []).map(r => ({
    id: r.id,
    title: r.title,
    starts_at: r.starts_at,
    vibe: r.vibe,
    host: {
      id: r.profiles?.id || null,
      name: r.profiles?.name || '',
      avatar_url: r.profiles?.avatar_url || null,
    },
  }));

  return NextResponse.json(results);
} 