// app/user/page.jsx  (Server Component shell)
import DiscoverClient from '@/components/event/DiscoverClient';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/utils/supabase/server';
import { signedUrl } from '@/utils/signedUrl';

export default async function UserPage() {
  const session = await getServerSession(authOptions);  // +++
  if (!session) {                                       // +++
    redirect('/login');                                 // +++
  }                                                     // +++

  /* ---------- server-side fetch + thumbnail signing ---------- */
  const sb = await createSupabaseServer();

  // 1. Fetch events (approved + future)
  const { data: events } = await sb
    .from('events')
    .select('*')
    .eq('status', 'approved')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at');

  if (!events) return <DiscoverClient events={[]} />;

  // 2. Generate 320×240 thumbnails in parallel (service-role for speed)
  const thumbs = await Promise.all(
    events.map(async (e) => {
      if (!e.img_path) return null;
      return await signedUrl('event-images', e.img_path, 60 * 60, {
        width: 320,
        height: 240,
        resize: 'cover',
        quality: 70,
      });
    })
  );

  const eventsWithThumbs = events.map((e, idx) => ({ ...e, thumb: thumbs[idx] }));

  return <DiscoverClient initialEvents={eventsWithThumbs} />;
}
