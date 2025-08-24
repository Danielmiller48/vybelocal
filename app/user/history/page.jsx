import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/utils/auth';
import { createSupabaseServer } from '@/utils/supabase/server';
import HostEventTable from '@/components/host/HostEventTable';

export const dynamic = 'force-dynamic';

export default async function UserPastEvents() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login?next=/user/history');

  const sb = await createSupabaseServer();
  const nowIso = new Date().toISOString();

  const { data: rsvpEvents, error } = await sb
    .from('events')
    .select('*, rsvps!inner(user_id)')
    .eq('rsvps.user_id', session.user.id)
    .order('starts_at', { ascending: false });
  if (error) throw error;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Your Past Events</h1>
      <HostEventTable events={rsvpEvents} showUpcomingTab={false} initialTab="past" />
    </div>
  );
} 