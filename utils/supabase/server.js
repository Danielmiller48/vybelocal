// utils/supabase/middleware.js
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * Refresh the user’s session on every request and sync cookies
 * @param {import('next/server').NextRequest} request
 */
export async function updateSession(request) {
  // 1️⃣ set up a response we can mutate
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // 2️⃣ build a Supabase client wired to read + write cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // read cookies coming *in* from the browser
        getAll() {
          return request.cookies.getAll()
        },
        // write refreshed cookies to both the incoming request
        // (for server components) and the outgoing response
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            request.cookies.set(name, value, options)    // for the server
            response.cookies.set(name, value, options)   // for the browser
          })
        },
      },
    },
  )

  // 3️⃣ this call refreshes the JWT if it’s stale and triggers setAll()
  await supabase.auth.getUser()

  return response
}