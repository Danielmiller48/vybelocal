// utils/supabase/server.js
// -----------------------------------------------------------------------------
// Helper for server components / API routes.
// • Default   → anon key  (RLS ON)
// • admin:true → service key (RLS OFF – use only in trusted scripts)
// -----------------------------------------------------------------------------

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR    = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * createSupabaseServer({ admin = false })
 * --------------------------------------
 * @param {boolean} admin  – when true, uses service key (bypasses RLS)
 * @returns Supabase server client
 */
export async function createSupabaseServer({ admin = false } = {}) {
  const jar = await cookies();                       // Next.js cookies helper

  // Choose the key: anon by default, service key only when explicitly requested
  const KEY = admin && SR ? SR : ANON;

  return createServerClient(URL, KEY, {
    cookies: {
      get:      (name)      => jar.get(name)?.value,
      getAll:   async ()    => jar.getAll().map(c => ({ name: c.name, value: c.value })),
      set:      (name, val, opt) => jar.set({ name, value: val, ...opt }),
      setAll:   async arr   => arr.forEach(c => jar.set(c)),
      remove:   (name, opt) => jar.delete({ name, ...opt }),
    },
  });
}
