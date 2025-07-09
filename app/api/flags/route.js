import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function DELETE(request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const session = { user };

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

// DEBUG: Use service role key to fetch all flags, bypassing session/RLS
export async function GET(request) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await supabase.from('flags').select('*');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const session = { user };

  const { id, status } = await request.json();
  if (!id || !status) {
    return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('flags')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const session = { user };

  const { target_type, target_id, reason_code, details, source, user_id } = await request.json();
  if (!target_type || !target_id || !reason_code) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const insertObj = {
    target_type,
    target_id,
    reporter_id: session.user.id,
    reason_code,
    details,
    source: source || 'user',
    // status, severity, created_at use defaults
  };
  if (user_id) insertObj.user_id = user_id;

  const { error } = await supabase.from('flags').insert(insertObj);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
} 