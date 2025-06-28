/* utils/supabase/server.js
   Server-side Supabase client (Next 15.3 async cookies)
   -- ALWAYS uses Service-Role key when you set it
*/

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR   = process.env.SUPABASE_SERVICE_ROLE_KEY;          // ← MUST exist in .env

export async function createSupabaseServer() {
  const jar = await cookies();                                // async in Next 15

  if (!SR) {
    console.warn(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY is missing – falling back to anon key!'
    );
  }

  return createServerClient(
    URL,
    SR || ANON,                                               // SR when present
    {
      cookies: {
        get:    (n)       => jar.get(n)?.value,
        getAll: async ()  => jar.getAll().map(c => ({ name: c.name, value: c.value })),
        set:    (n, v, o) => jar.set({ name: n, value: v, ...o }),
        setAll: async a   => a.forEach(c => jar.set(c)),
        remove: (n, o)    => jar.delete({ name: n, ...o }),
      },
    }
  );
}
