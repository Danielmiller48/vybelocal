// ── components/Header.js ──
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useSupabase } from '@/app/ClientProviders';
import AvatarFallback from '@/components/common/AvatarFallback';
import { getAvatarUrl } from '@/utils/supabase/avatarCache';

const Placeholder = () => (
  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold text-white select-none">
    ?
  </div>
);

export default function Header() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { supabase } = useSupabase();

  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  /* ───────── fetch profile & signed URL ───────── */
  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, avatar_url')
        .eq('id', session.user.id)
        .single();

      if (!profile || ignore) return;
      setIsAdmin(!!profile.is_admin);

      if (profile.avatar_url) {
        const url = await getAvatarUrl(profile.avatar_url);
        if (!ignore) setAvatarUrl(url);
      } else {
        setAvatarUrl(null);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [session, supabase]);

  const doSignOut = () => signOut({ callbackUrl: '/' });

  return (
    <header className="bg-white shadow-sm sticky top-0 z-20">
      <nav className="max-w-5xl mx-auto flex items-center px-4 h-12">
        <Link href="/" className="text-xl sm:text-2xl font-bold text-violet-700">
          VybeLocal
        </Link>

        <div className="ml-auto flex items-center gap-5 text-sm">
          {session?.user && (
            <>
              <Link href="/user" className="hover:text-violet-600">
                Dashboard
              </Link>
              <Link href="/host" className="hover:text-violet-600">
                Host a Vybe
              </Link>
              {isAdmin && (
                <Link href="/admin/dashboard" className="hover:text-violet-600">
                  Admin
                </Link>
              )}
            </>
          )}

          {/* avatar */}
          {status === 'loading' ? (
     <Placeholder />          /* renders on the server too */
   ) : session?.user ? (
            <>
              <button
                onClick={() => router.push('/user/profile')}
                title="Edit profile"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <Placeholder />
                )}
              </button>
              <button
                onClick={doSignOut}
                className="hover:underline hidden sm:inline"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-violet-600">
                Log In
              </Link>
              <Link href="/register" className="hover:text-violet-600">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
