'use client';
import { useState, useEffect } from 'react';
import { useSession }          from 'next-auth/react';
import { useRouter }           from 'next/navigation';
import supabase                from '@/utils/supabase/browser';

export default function RSVPButton({ eventId }) {
  const { data: nxt, status } = useSession();
  const router  = useRouter();
  const [joined,  setJoined]  = useState(false);
  const [loading, setLoading] = useState(true);

  /* Bridge NextAuth → Supabase once */
  useEffect(() => {
    if (
      status === 'authenticated' &&
      nxt?.supabaseAccessToken &&
      !supabase.auth.getUser().data.user
    ) {
      supabase.auth.setSession({
        access_token : nxt.supabaseAccessToken,
        refresh_token: nxt.supabaseRefreshToken ?? null
      }).catch(() => {});
    }
  }, [status, nxt]);

  /* Has this user already RSVPed? */
  useEffect(() => {
    async function check() {
      if (status !== 'authenticated') return setLoading(false);
      const { data } = await supabase
        .from('rsvps')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('user_id', nxt.user.id)
        .maybeSingle();
      setJoined(!!data);
      setLoading(false);
    }
    check();
  }, [status, nxt, eventId]);

  /* Click handler */
  async function handleClick() {
    if (status !== 'authenticated') {
      router.push(`/login?next=/vybes/${eventId}`);
      return;
    }
    setLoading(true);

    /* one-and-only row per (event_id,user_id) */
    const { error } = await supabase
      .from('rsvps')
      .upsert(
        { event_id: eventId, user_id: nxt.user.id },
        { onConflict: 'event_id,user_id', ignoreDuplicates: true }
      );

    /* Any error here is unexpected ─ surface it */
    if (error && error.code !== '23505') alert(error.message);

    setJoined(true);
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || joined}
      className="mt-4 w-full py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
      {joined ? 'Going ✔' : loading ? '…' : 'RSVP'}
    </button>
  );
}
