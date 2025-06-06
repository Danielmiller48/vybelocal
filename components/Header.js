// ── components/Header.js ──
'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const { data: session, status } = useSession();

  // ── 1. Debug hook: remove when happy ──
  console.log('Header sees session:', session, 'status:', status);

  // ── 2. Decide what to show ──
  const isLoading   = status === 'loading';
  const isLoggedIn  = !!session;
  const displayName = session?.user?.name || session?.user?.email;

  return (
    <header className="bg-white shadow-md">
      <nav className="max-w-4xl mx-auto flex items-center px-4 py-3">
        {/* Logo / home link */}
        <Link href="/" className="text-2xl font-bold text-indigo-600">
          VybeLocal
        </Link>

        {/* Spacer pushes everything else right */}
        <div className="ml-auto flex items-center space-x-6">
          {/* Always-visible links */}
          <Link href="/find"  className="text-gray-700 hover:text-indigo-600">
            Find a Vybe
          </Link>
          <Link href="/host"  className="text-gray-700 hover:text-indigo-600">
            Host a Vybe
          </Link>

          {/* Auth-sensitive area */}
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
              <Link href="/login"    className="text-gray-700 hover:text-indigo-600">
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
  );
}