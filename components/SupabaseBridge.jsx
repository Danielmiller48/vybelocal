'use client';

/**
 * Supabase ↔ Next-Auth bridge
 * • Runs once after the user logs in
 * • Copies Next-Auth JWT tokens into supabase.auth cookies
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createSupabaseBrowser } from '@/utils/supabase/client';

export default function SupabaseBridge() {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const supabase = createSupabaseBrowser();        // ✅ browser helper, no await

  useEffect(() => {
    if (status !== 'authenticated') return;        // user not logged in yet

    const { access_token, refresh_token } = session?.supabase ?? {};
    if (!access_token || !refresh_token) return;   // nothing to copy

    (async () => {
      // Skip if already bridged
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return;

      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) console.error('SupabaseBridge error', error);
      else router.refresh();                       // forces middleware re-run
    })();
  }, [status, session, supabase, router]);

  return null;                                     // no UI
}
