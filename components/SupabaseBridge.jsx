// components/SupabaseBridge.jsx
'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSupabase } from '@/app/ClientProviders';

export default function SupabaseBridge() {
  const { status, data: session } = useSession();
  const supabase = useSupabase();

  useEffect(() => {
    console.log('Bridge status:', status);                 // ← add
    if (status !== 'authenticated') return;

    console.log('Bridge got session:', session);           // ← add
    const { access_token, refresh_token } = session.supabase || {};
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token })
        .then(() => console.log('Supabase session set ✔︎')); // ← add
    }
  }, [status, session, supabase]);

  return null;
}
