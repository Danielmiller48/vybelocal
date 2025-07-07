// app/host/tools/page.jsx   (server component)
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createSupabaseServer} from '@/utils/supabase/server';
import EventCard from '@/components/event/EventCard';

export const dynamic = 'force-dynamic';

export default async function HostTools() {
  /* ---------- auth ---------- */
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login?next=/host/tools');

  /* ---------- data ---------- */
  const sb = await createSupabaseServer();
  const { data, error } = await sb
    .from('v_host_my_events')
    .select('*')
    .order('starts_at', { ascending: false });

  if (error) throw error;

  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">My Events</h1>
      {data.length === 0 && <p>No events yet.</p>}
      {data.map(evt => (
        <EventCard
          key={evt.id}
          event={evt}
          href={`/host/events/${evt.id}`}
          extra={<span className="text-sm">{evt.rsvp_count} RSVPs</span>}
        />
      ))}
    </section>
  );
}
