// app/ClientProviders.jsx
'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { createSupabaseBrowser } from '@/utils/supabase/client'
import BanModalClient from '@/components/BanModalClient'
import SoftBanModalClient from '@/components/SoftBanModalClient'
import WarnModalClient from '@/components/WarnModalClient'

/* ── Supabase React context ── */
const SupabaseCtx = createContext({ supabase: null, session: null })
export const useSupabase = () => useContext(SupabaseCtx)

/* ── Main wrapper ── */
export default function ClientProviders({ children, session: nextAuthSession }) {
  /* one browser client per tab */
  const supabase = useMemo(() => createSupabaseBrowser(), [])

  const [sbSession, setSbSession] = useState(null)

  /* keep Supabase session in sync */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSbSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_evt, sess) => setSbSession(sess)
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  return (
    <NextAuthSessionProvider session={nextAuthSession}>
      <SupabaseCtx.Provider value={{ supabase, session: sbSession }}>
        <WarnModalClient />
        <SoftBanModalClient />
        <BanModalClient />
        {children}
      </SupabaseCtx.Provider>
    </NextAuthSessionProvider>
  )
}
