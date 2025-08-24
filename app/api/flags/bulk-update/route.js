import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function POST(request) {
  const sb = await createSupabaseServer();
  const { data: { user }, error: userError } = await sb.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Verify admin flag
  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // use service key for privileged updates
  const supabase = await createSupabaseServer({ admin: true });
  const session = { user };

  const { userId, status } = await request.json();
  if (!userId || !status) {
    return NextResponse.json({ error: 'Missing userId or status' }, { status: 400 });
  }

  // Punishment pipeline logic
  if (status === 'actioned') {
    // Fetch current profile state
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('warning_issued, soft_ban_expires_at, is_permanently_banned')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    // Escalate punishment
    if (!profile.warning_issued) {
      // Step 1: Issue warning
      await supabase.from('profiles').update({ warning_issued: true }).eq('id', userId);
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'You have received a warning',
        message: 'This is your first strike. Please review the community guidelines to avoid further action.'
      });
    } else if (!profile.soft_ban_expires_at || new Date(profile.soft_ban_expires_at) < new Date()) {
      // Step 2: 24h suspension
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
      await supabase.from('profiles').update({ soft_ban_expires_at: expires.toISOString() }).eq('id', userId);
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'You have been suspended for 24 hours',
        message: 'Strike 2 of 3. You are temporarily suspended for 24 hours. Continued violations will result in a permanent ban.'
      });
    } else if (!profile.is_permanently_banned) {
      // Step 3: Permanent ban
      await supabase.from('profiles').update({ is_permanently_banned: true }).eq('id', userId);
    }
  }
  if (status === 'ban') {
    // Immediate permaban
    await supabase.from('profiles').update({ is_permanently_banned: true }).eq('id', userId);
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'You have been permanently banned',
      message: 'You have reached strike 3. Your account has been permanently banned from VybeLocal.'
    });
    // Always set flag status to actioned
    await supabase.from('flags').update({ status: 'actioned' }).eq('user_id', userId);
    return NextResponse.json({ updated: 'banned' });
  }

  const { data, error, count } = await supabase
    .from('flags')
    .update({ status })
    .eq('user_id', userId)
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data.length });
} 