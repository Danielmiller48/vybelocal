/* components/AuthListener.jsx */
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/utils/supabase/client";

export default function AuthListener() {
  const router = useRouter();
  const hasRefreshed = useRef(false);          // ensure one-time only

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // First time we transition from "no user" → "has user"
        if (!hasRefreshed.current && event === "SIGNED_IN" && session) {
          hasRefreshed.current = true;
          router.refresh();                    // soft refresh, no full reload
        }
        // Ignore SIGNED_OUT, TOKEN_REFRESHED, etc.
      }
    );

    return () => sub.subscription.unsubscribe();
  }, [router]);

  return null;
}
