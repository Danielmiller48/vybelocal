// utils/supabase/middleware.js
import { NextResponse }   from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Refresh Supabase session cookies on every request
 * @param {import('next/server').NextRequest} request
 * @returns {Promise<NextResponse>}
 */
export async function updateSession(request) {
  // Response that we’ll eventually return
  const response = NextResponse.next()

  // Supabase client wired to read incoming cookies
  // and write any refreshed cookies onto the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get   : (name)               => request.cookies.get(name)?.value,
        set   : (name, value, opts)  => response.cookies.set(name, value, opts),
        remove: (name, opts)         => response.cookies.set(name, '', { ...opts, maxAge: 0 }),
      },
    },
  )

  // Touch the auth endpoint — refreshes session if the access token is stale
  await supabase.auth.getUser()

  return response
}
