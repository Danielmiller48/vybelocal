// mobile/hooks/useKybStatus.js
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchKybProfile, subscribeKyb } from '../utils/kyb';

export default function useKybStatus() {
  const { user } = useAuth();
  const [state, setState] = useState({ status: null, required: null, bankStatus: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    let sub = null;
    (async () => {
      if (!user?.id) { setState({ status: null, required: null, bankStatus: null, loading: false }); return; }
      const first = await fetchKybProfile(user.id); // 10s idempotent cache
      if (!cancelled) setState({ ...first, loading: false });
      sub = subscribeKyb(user.id, (next) => { if (!cancelled) setState((prev) => ({ ...prev, ...next })); });
    })();
    return () => { cancelled = true; if (sub) sub.unsubscribe(); };
  }, [user?.id]);

  return state;
}


