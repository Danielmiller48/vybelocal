// ── app/user/profile/page.jsx ──
// Server component: fetch current user's profile row and stream ProfileClient.

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/utils/supabase/server';
import ProfileClient from '@/components/ProfileClient';

export const dynamic = 'force-dynamic'; // always SSR so fresh profile

export default async function ProfilePage() {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await sb
    .from('profiles')
    .select('name, bio, phone, avatar_url')
    .eq('id', user.id)
    .single();

  return (
    <ProfileClient
      profile={{
        id: user.id,
        email: user.email, // current auth email
        name: profile?.name ?? '',
        bio: profile?.bio ?? '',
        phone: profile?.phone ?? '',
        avatar_url: profile?.avatar_url ?? null,
      }}
    />
  );
}