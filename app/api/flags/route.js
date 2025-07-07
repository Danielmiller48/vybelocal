import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function DELETE(request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { target_type, target_id } = await request.json();
  if (!target_type || !target_id) {
    return NextResponse.json({ error: 'Missing target_type or target_id' }, { status: 400 });
  }

  // Delete the flag for this user and target
  const { error } = await supabase
    .from('flags')
    .delete()
    .eq('reporter_id', session.user.id)
    .eq('target_type', target_type)
    .eq('target_id', target_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  let query = supabase.from('flags').select('*');
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('flags')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
} 