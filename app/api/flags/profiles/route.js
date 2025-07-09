import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

export async function GET(request) {
  const supabase = await createSupabaseServer();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const session = { user };

  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');
  if (!ids) {
    return NextResponse.json([], { status: 200 });
  }
  const idArr = ids.split(',').map((id) => id.trim());
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, name, email, phone, avatar_url, warning_issued, soft_ban_expires_at, is_permanently_banned')
    .in('id', idArr);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Debug logs
  console.log("Requested IDs:", idArr);
  console.log("Profiles found:", profiles);
  // Attach signed avatar URLs
  for (const p of profiles) {
    if (p.avatar_url) {
      if (p.avatar_url.startsWith('http')) {
        p.signed_avatar_url = p.avatar_url;
      } else {
        const { data: signed } = await supabase.storage
          .from('profile-images')
          .createSignedUrl(p.avatar_url, 60 * 60);
        p.signed_avatar_url = signed?.signedUrl || '/avatar-placeholder.png';
      }
    } else {
      p.signed_avatar_url = '/avatar-placeholder.png';
    }
  }
  return NextResponse.json(profiles);
} 