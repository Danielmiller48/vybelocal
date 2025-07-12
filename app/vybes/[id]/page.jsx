/* ─── Public event detail ─── */
import { createSupabaseServer } from '@/utils/supabase/server';
import { signedUrl }                  from '@/utils/signedUrl';
import RSVPButton                     from '@/components/event/RSVPButton';
import EventAttendees                 from '@/components/event/EventAttendees';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';

export const dynamic = 'force-dynamic';

export default async function VybeDetail({ params }) {
  /* 0 ─ unwrap params (Next 15 async API) */
  const { id } = await params;                // ← fix

  /* 1 ─ fetch the approved-only view */
  const sb = await createSupabaseServer();

  // get user id if signed in (SSR)
  const { data: { user } } = await sb.auth.getUser();
  const { data: ev, error } = await sb
    .from('public_events')                    // same view the grid uses
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error)
    return <p className="p-6 text-red-600">Supabase error: {error.message}</p>;
  if (!ev)
    return <h1 className="p-6 text-xl">Event not found or not approved.</h1>;

  /* 2 ─ hero image (service-role helper handles RLS) */
  const hero = ev.img_path
    ? await signedUrl('event-images', ev.img_path, 3600)
    : null;

  /* 3 ─ RSVP count & joined (server-side) */
  let initialJoined = null;
  let initialRsvpCount = null;

  // Total RSVP count (available to everyone)
  const { count } = await sb
    .from('rsvps')
    .select('event_id', { count: 'exact' })
    .eq('event_id', ev.id);
  initialRsvpCount = count ?? 0;

  // Joined status only if logged in
  if (user) {
    const { data: joinedRow } = await sb
      .from('rsvps')
      .select('event_id')
      .eq('event_id', ev.id)
      .eq('user_id', user.id)
      .maybeSingle();
    initialJoined = Boolean(joinedRow);
  }

  /* 4 ─ render */
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      {hero && (
        <img
          src={hero}
          alt=""
          className="w-full max-h-[70vh] rounded-lg object-contain"
        />
      )}

      <h1 className="text-3xl font-bold">{ev.title}</h1>

      <div className="flex gap-4 text-sm text-gray-600">
        <span className="px-2 py-0.5 rounded bg-gray-200 capitalize">
          {ev.vibe}
        </span>
        <time>{new Date(ev.starts_at).toLocaleString()}</time>
      </div>

      {ev.description && <p>{ev.description}</p>}
      {ev.address && (
        <p className="text-gray-700">
          <strong>Location:</strong> {ev.address}
        </p>
      )}

      <RSVPButton
        eventId={ev.id}
        initialJoined={initialJoined}
        initialRsvpCount={initialRsvpCount}
        capacity={ev.rsvp_capacity}
      />
      
      <EventAttendees eventId={ev.id} />
    </main>
  );
}
