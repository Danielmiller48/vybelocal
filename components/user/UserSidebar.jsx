// ── components/UserSidebar.jsx ──
'use client'

import { useState, useEffect }   from 'react'
import Link           from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X }    from 'lucide-react'
import { createSupabaseBrowser } from '@/utils/supabase/client';

/**
 * Mobile‑first sidebar for /user routes.
 *
 * ▸ On <640px it collapses into a hamburger; slides over when open.
 * ▸ On ≥640px (sm breakpoint) it sticks on the left at 14rem.
 * ▸ Links: Discover, Calendar, Profile ‑‑ highlight the active route.
 * ▸ Avatar click navigates to /user/profile.
 *
 * Pass `avatarUrl` as prop or swap the placeholder logic.
 */
export default function UserSidebar() {
  const pathname        = usePathname()
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    async function fetchAvatar() {
      const supabase = createSupabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();
      setAvatarUrl(profile?.avatar_url ?? null);
    }
    fetchAvatar();
  }, []);

  const nav = [
    { href: '/user',           label: 'Discover' },
    { href: '/user/calendar',  label: 'Calendar' },
    { href: '/user/profile',   label: 'Profile'  },
    { href: '/user/blocked',   label: 'Blocked Profiles' },
  ]

  /* utility */
  const linkCls = (href) =>
    `block px-4 py-2 rounded hover:bg-violet-100 ${
      pathname === href ? 'bg-violet-100 font-medium text-violet-700' : ''
    }`

  return (
    <>
      {/* mobile top bar */}
      <header className="sm:hidden flex items-center justify-between h-12 px-4 shadow-md">
        <button onClick={() => setOpen(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-semibold text-violet-700">Dashboard</span>
        <button onClick={() => (window.location.href = '/user/profile')}
                className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
          {avatarUrl && <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />}
        </button>
      </header>

      {/* overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed z-50 top-0 left-0 h-full w-56 bg-white border-r shadow-lg transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0 sm:static sm:shadow-none`}
      >
        <div className="flex items-center justify-between h-12 px-4 sm:hidden">
          <span className="font-semibold text-violet-700">Menu</span>
          <button onClick={() => setOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-2 pt-4 space-y-1">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={linkCls(n.href)}>
              {n.label}
            </Link>
          ))}
        </div>
      </aside>
    </>
  )
}
