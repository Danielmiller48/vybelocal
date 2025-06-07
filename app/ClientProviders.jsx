// app/ClientProviders.jsx
'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { SessionProvider as NextAuthSessionProvider, useSession } from 'next-auth/react'

import { supabase as supabaseBrowser } from '@/lib/supabaseClient'   // ← the helper we made
import Providers                 from './providers'

/* ---------- Supabase React context ---------- */
const SupabaseCtx = createContext({ supabase: supabaseBrowser, session: null })
export const useSupabase = () => useContext(SupabaseCtx)

/* ---------- Debug helper (keep / drop as you like) ---------- */
function DebugTap({ label }) {
  const { data, status } = useSession()
  console.log(label, data, status)
  return null
}

/* ---------- Main wrapper ---------- */
export default function ClientProviders({ children, session: nextAuthSession }) {
  // One Supabase client per tab — memoised
  const supabase = useMemo(() => supabaseBrowser, [])

  const [sbSession, setSbSession] = useState(null)

  /* 🔄 keep Supabase session in sync */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSbSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => setSbSession(sess)
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <NextAuthSessionProvider session={nextAuthSession}>
      <SupabaseCtx.Provider value={{ supabase, session: sbSession }}>
                  {/* now uses useSupabase() inside */}
        <DebugTap label="inside provider" /> {/* remove if noisy */}
        <Providers session={nextAuthSession}>{children}</Providers>
      </SupabaseCtx.Provider>
    </NextAuthSessionProvider>
  )
}