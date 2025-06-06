// app/ClientProviders.jsx
'use client';

import { useMemo } from 'react';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider as SupabaseSessionProvider } from '@supabase/auth-helpers-react';

import Providers from './providers';
import SupabaseBridge from '../components/SupabaseBridge';   // ← correct path
import { useSession } from 'next-auth/react';

function DebugTap({ label }) {
  const { data, status } = useSession();
  console.log(label, data, status);
  return null;
}

export default function ClientProviders({ children, session }) {
  // one Supabase client per tab
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  return (
    <NextAuthSessionProvider session={session}>
      <SupabaseSessionProvider supabaseClient={supabase}>
        <SupabaseBridge />                 {/* now shares same client */}
        {/* remove if you don’t need console output */}
        <DebugTap label="inside provider" />
        <Providers session={session}>{children}</Providers>
      </SupabaseSessionProvider>
    </NextAuthSessionProvider>
  );
}
