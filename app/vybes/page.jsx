// app/vybes/page.jsx
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/utils/supabase/server';
import { signedUrl } from '@/utils/signedUrl';
import EventCard from '@/components/EventCard';

const BUCKET        = 'event-images';
const TTL_SECONDS   = 60 * 60;
const THUMB_OPTIONS = { width: 320, height: 180, resize: 'cover' };

export const revalidate = 60; // ISR — refresh every minute

export default async function VybesPage() {
  const sb = await createSupabaseServer();

  /* ── login gate (non-admin pages must be signed-in) ── */
  const { data: { session } } = await sb.auth.getSession();
  if (!session) redirect('/login');

  /* 1. fetch approved events */
  const { data: events, error } = await sb
    .from('public_events')
    .select('*')
    .order('starts_at', { ascending: true });

if (error) {
  console.error("Supabase error fetching events:", error.message);
  return <main className="p-6">Something went wrong while fetching events.</main>;
};

  /* 2. attach signed thumbnails */
  const cards = await Promise.all(
    events.map(async e => ({
      ...e,
      thumb: await signedUrl(BUCKET, e.img_path, TTL_SECONDS, THUMB_OPTIONS),
    })),
  );

  /* 3. render */
  return (
    <main className="p-6">
      {cards.length === 0 ? (
        <p>No approved events yet—be the first to host!</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
          {cards.map(c => (
            <EventCard key={c.id} event={c} img={c.thumb} />
          ))}
        </div>
      )}
    </main>
  );
}
