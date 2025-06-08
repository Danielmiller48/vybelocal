// ── components/Header.js ──
'use client'

import { useEffect, useState } from 'react'
import Link                     from 'next/link'
import { useSession, signOut }  from 'next-auth/react'
import { useSupabase }          from '@/app/ClientProviders'   // ⬅️ new

export default function Header() {
  const { data: session, status } = useSession()
  const { supabase } = useSupabase()           // shared browser client
  const [isAdmin, setIsAdmin] = useState(false)

  /* ─ fetch once per mount if logged in ─ */
  useEffect(() => {
    let ignore = false
    async function fetchRole() {
      if (!session?.user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
      if (!ignore) setIsAdmin(!!profile?.is_admin)
    }
    fetchRole()
    return () => { ignore = true }
  }, [session, supabase])

  const isLoading   = status === 'loading'
  const isLoggedIn  = !!session
  const displayName = session?.user?.name || session?.user?.email

  return (
    <header className="bg-white shadow-md">
      <nav className="max-w-4xl mx-auto flex items-center px-4 py-3">
        {/* Logo */}
        <Link href="/" className="text-2xl font-bold text-indigo-600">
          VybeLocal
        </Link>

        {/* Right-side nav */}
        <div className="ml-auto flex items-center space-x-6">
          <Link href="/vybes" className="text-gray-700 hover:text-indigo-600">
            Find a Vybe
          </Link>
          <Link href="/host" className="text-gray-700 hover:text-indigo-600">
            Host a Vybe
          </Link>

          {/* Admin link — only for mods */}
          {isAdmin && (
            <Link href="/admin/dashboard" className="text-gray-700 hover:text-indigo-600">
              Admin
            </Link>
          )}

          {/* Auth area */}
          {isLoading ? null : isLoggedIn ? (
            <>
              <span className="text-gray-700">
                Welcome back{displayName ? `, ${displayName}!` : '!'}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-gray-700 hover:text-indigo-600"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-gray-700 hover:text-indigo-600">
                Log In
              </Link>
              <Link href="/register" className="text-gray-700 hover:text-indigo-600">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
