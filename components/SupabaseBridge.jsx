/* components/SupabaseBridge.jsx */
"use client";

/**
 * Supabase ↔ Next-Auth bridge
 * • When Next-Auth session is present → copy its tokens into Supabase
 * • When Next-Auth session vanishes   → supabase.auth.signOut()  (prevents bleed)
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function SupabaseBridge() {
  const { data: session, status } = useSession();
  const router   = useRouter();
  const supabase = createSupabaseBrowser();
  const lastUser = useRef(null);                 // track current UID

  useEffect(() => {
    (async () => {
      // 1. USER IS LOGGED IN  ----------------------------------------------
      if (status === "authenticated") {
        const { access_token, refresh_token, user_id } = session?.supabase ?? {};
        if (!access_token || !refresh_token) return;          // nothing to sync

        // If we've already synced this user, skip
        if (lastUser.current === user_id) return;

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) console.error("SupabaseBridge error", error);
        else {
          lastUser.current = user_id;           // remember who we are now
          router.refresh();                     // refetch RLS-protected pages
        }
      }

      // 2. USER JUST LOGGED OUT  -------------------------------------------
      if (status === "unauthenticated" && lastUser.current) {
        await supabase.auth.signOut();          // wipe old JWT
        lastUser.current = null;
        // No router.refresh() needed; you already redirect to /login
      }
    })();
  }, [status, session, supabase, router]);

  return null;                                  // headless bridge
}
