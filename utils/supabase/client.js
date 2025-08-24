// utils/supabase/client.js — single browser client (Next.js + @supabase/ssr)
// This replaces both /lib/supabaseClient.js and the previous utils variant
// to avoid duplicate bundles and option drift.

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createSupabaseBrowser() {
  return createBrowserClient(supabaseUrl, supabaseAnon, {
    auth: {
      persistSession: true,        // keeps JWT in localStorage
      detectSessionInUrl: true,    // pick up token after magic‑link
      flow: 'pkce',               // modern, secure OAuth flow
    },
    cookieOptions: { sameSite: 'lax' },
  });
}
