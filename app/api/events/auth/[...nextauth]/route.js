// app/api/events/auth/[...nextauth]/route.js — rebuilt clean
import NextAuth from 'next-auth';
import { authOptions } from '@/utils/auth';

/**
 * Next‑Auth endpoint (GET & POST).
 * Placed under /api/events/auth/ so existing links keep working after the migration.
 *
 * • authOptions already injects Supabase access/refresh tokens into the session
 *   (session.supabase.access_token, session.supabase.refresh_token) so that
 *   the <SupabaseBridge /> component can copy them into Supabase cookies on the client.
 * • No Supabase calls are made directly in this route—everything is handled in
 *   the `authorize` callback inside authOptions.
 */
const handler = NextAuth(authOptions);

export const GET  = handler;
export const POST = handler;
