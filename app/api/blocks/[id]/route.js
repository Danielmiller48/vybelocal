import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function DELETE(request, { params }) {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'Missing block ID' }, { status: 400 });
  }
  // Only allow deleting blocks owned by the user
  const { data: block, error: fetchError } = await supabase
    .from('blocks')
    .select('id')
    .eq('id', id)
    .eq('blocker_id', session.user.id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!block) {
    return NextResponse.json({ error: 'Block not found or not owned by user' }, { status: 404 });
  }
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('id', id)
    .eq('blocker_id', session.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
} 