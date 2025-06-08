// utils/supabase/server.js
import { cookies }            from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Create a Supabase client for the current request.
 * Must be awaited wherever you call it.
 */
export async function supabase() {
  // wait here – satisfies Next 15 “dynamic” rule
  const jar = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get   : (key)               => jar.get(key)?.value,
        getAll: ()                  => jar.getAll(),
        set   : (key, val, opts)    => jar.set({ name: key, value: val, ...opts }),
        remove: (key, opts)         => jar.set({ name: key, value: '', ...opts }),
      },
    }
  )
}
