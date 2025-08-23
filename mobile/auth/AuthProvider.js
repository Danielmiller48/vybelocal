// mobile/auth/AuthProvider.js — email/password only
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext({ user: null, session: null, profile: null });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Bootstrap session and subscribe to changes
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession ?? null);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load minimal profile when session present
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = session?.user?.id;
      if (!uid) { setProfile(null); return; }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id,name,avatar_url,stripe_account_id')
          .eq('id', uid)
          .maybeSingle();
        if (!cancelled) setProfile(data || null);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password });

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    signIn,
    signUp,
    signOut: () => supabase.auth.signOut(),
  };

  if (loading) return null;
  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);