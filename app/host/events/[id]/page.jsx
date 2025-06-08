// app/host/events/[id]/page.jsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabase as createSupabase } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function HostEventPage({ params: { id } }) {
  /* ---------- auth gate ---------- */
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?next=/host/events/${id}`);

  /* ---------- fetch event ---------- */
  const sb = await createSupabase();
  const { data: evt, error } = await sb
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('host_id', session.user.id)   // safety: must own the event
    .maybeSingle();

  if (error) throw error;
  if (!evt) redirect('/host/tools');   // not yours or not found

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{evt.title}</h1>
      <p>Status: {evt.status}</p>

      {/* placeholder — drop EditEventForm & roster later */}
      <p className="text-muted">
        Edit form and RSVP roster coming in the next step.
      </p>
    </main>
  );
}
