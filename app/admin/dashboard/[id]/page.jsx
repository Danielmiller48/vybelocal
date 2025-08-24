/* app/admin/dashboard/[id]/page.jsx ─ Admin event detail */
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/app/api/auth/[...nextauth]/route';
import sbAdmin              from '@/utils/supabase/admin';   // service-role client
import { signedUrl }        from '@/utils/signedUrl';
import { decideEvent }      from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminEventPage({ params }) {
  /* 0 ─ unwrap params (Next 15 async API) */
  const { id } = await params;

  /* 1 ─ auth gate */
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  /* 2 ─ fetch event (service-role bypasses RLS) */
  const { data: ev, error } = await sbAdmin
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error)
    return <p className="p-6 text-red-600">Supabase error: {error.message}</p>;
  if (!ev)
    return <h1 className="p-6 text-xl">Event not found.</h1>;

  /* 3 ─ hero image (original size) */
  const hero = await signedUrl('event-images', ev.img_path, 3600);

  /* 4 ─ server actions */
  async function approve() { 'use server'; await decideEvent(id, true); }
  async function reject()  { 'use server'; await decideEvent(id, false); }

  /* 5 ─ render */
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
        <span className="px-2 py-0.5 rounded bg-yellow-200 uppercase">
          {ev.status}
        </span>
      </div>

      {ev.description && <p>{ev.description}</p>}
      {ev.address && (
        <p className="text-gray-700">
          <strong>Location:</strong> {ev.address}
        </p>
      )}

      {ev.status === 'pending' && (
        <form className="flex gap-4 mt-4">
          <button
            formAction={approve}
            className="flex-1 py-2 rounded bg-green-600 text-white hover:bg-green-700">
            Approve
          </button>
          <button
            formAction={reject}
            className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700">
            Reject
          </button>
        </form>
      )}
    </main>
  );
}
