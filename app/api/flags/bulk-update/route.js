import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { userId, status } = await request.json();
  if (!userId || !status) {
    return NextResponse.json({ error: 'Missing userId or status' }, { status: 400 });
  }

  const { data, error, count } = await supabase
    .from('flags')
    .update({ status })
    .eq('user_id', userId)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data.length });
} 