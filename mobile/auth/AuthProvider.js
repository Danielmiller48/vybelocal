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
        const { data, error } = await supabase
          .from('profiles')
          .select('id,name,avatar_url,avatar_path')
          .eq('id', uid)
          .maybeSingle();
        if (error) { console.warn('[AuthProvider] profiles fetch error', error.message); }
        let out = data || null;
        try { console.log('[AuthProvider] profiles row', { uid, hasRow: !!out, avatar_url: out?.avatar_url || null, avatar_path: out?.avatar_path || null }); } catch {}
        if (out && (!out.avatar_url || out.avatar_url === '/avatar-placeholder.png') && !out.avatar_path) {
          try {
            const { data: puc } = await supabase
              .from('public_user_cards')
              .select('avatar_url')
              .eq('uuid', uid)
              .maybeSingle();
            if (puc?.avatar_url) out = { ...out, avatar_url: puc.avatar_url };
            try { console.log('[AuthProvider] puc fallback', { found: !!puc?.avatar_url }); } catch {}
          } catch {}
        }
        if (!cancelled) setProfile(out);
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