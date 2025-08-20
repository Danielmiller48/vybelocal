import Constants from 'expo-constants';
import { supabase } from './supabase';

function getApiBaseUrl() {
  return (
    Constants?.expoConfig?.extra?.apiBaseUrl ||
    process?.env?.EXPO_PUBLIC_API_BASE_URL ||
    'https://vybelocal.com'
  );
}

export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const method = options.method || 'GET';
  let headers = { ...(options.headers || {}) };

  let token = options.tokenOverride;
  if (!token) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || null;
    } catch {}
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 10000;
  const to = setTimeout(() => controller.abort(), timeoutMs);
  const resp = await fetch(url, {
    method,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    signal: controller.signal,
  });
  clearTimeout(to);

  const isJson = (resp.headers.get('content-type') || '').includes('application/json');
  if (!resp.ok) {
    let reason = `${resp.status}`;
    if (isJson) {
      try { const j = await resp.json(); reason = j?.reason || j?.error || reason; } catch {}
    } else {
      try { reason = await resp.text(); } catch {}
    }
    const err = new Error(typeof reason === 'string' ? reason : 'Request failed');
    err.status = resp.status;
    throw err;
  }

  return isJson ? resp.json() : resp.text();
}


