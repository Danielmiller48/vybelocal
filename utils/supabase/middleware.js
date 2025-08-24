// utils/supabase/middleware.js — unified token‑refresh + login‑gate
import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/utils/supabase/server';

// Routes that anyone may view while signed‑out
const PUBLIC = [
  '/',
  '/login',
  '/register',
  '/api/auth',                // Next‑Auth callbacks
  '/favicon',
  '/privacy',
  '/terms',
  '/community-guidelines',
];

export async function updateSession(request) {
  // Prepare the outgoing response so we can layer headers/cookies onto it
  const res = NextResponse.next();

  /* 1 — refresh Supabase tokens */
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();            // also renews cookies automatically

  /* 2 — propagate user‑id for downstream RSCs */
  if (user) res.headers.set('x-user-id', user.id);

  /* 3 — login‑gate for non‑public paths */
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith('/_next');               // static assets & chunks

  if (!isPublic && !user) {
    const login = new URL('/login', request.url);
    login.searchParams.set('redirect', pathname); // optional deep‑link after login
    return NextResponse.redirect(login);
  }

  return res;
}
