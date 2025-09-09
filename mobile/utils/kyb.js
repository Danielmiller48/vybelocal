// mobile/utils/kyb.js
import { supabase } from './supabase';
import Constants from 'expo-constants';

export function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'submitted') return 'in_review';
  return s || null;
}

// Simple in-memory cache with 10s idempotency window per user
const KYB_CACHE = new Map(); // userId -> { at: ms, data, inflight: Promise }
const WINDOW_MS = 10 * 1000;

export async function fetchKybProfile(userId) {
  if (!userId) return { status: null, required: null, bankStatus: null };
  const now = Date.now();
  const entry = KYB_CACHE.get(userId);
  if (entry && (now - entry.at) < WINDOW_MS) {
    return entry.data;
  }
  if (entry?.inflight) return entry.inflight;

  const inflight = (async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('moov_status, moov_account_id, bank_verification_status')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      const out = { status: null, required: null, bankStatus: null };
      KYB_CACHE.set(userId, { at: now, data: out, inflight: null });
      return out;
    }
    const out = {
      status: normalizeStatus(data?.moov_status),
      required: data?.moov_account_id ? null : 'account_required',
      bankStatus: data?.bank_verification_status || null,
    };
    KYB_CACHE.set(userId, { at: Date.now(), data: out, inflight: null });
    return out;
  })();

  KYB_CACHE.set(userId, { at: now, data: entry?.data || null, inflight });
  return inflight;
}

export function subscribeKyb(userId, onUpdate) {
  if (!userId) return { unsubscribe: () => {} };
  const channel = supabase
    .channel('kyb-profile')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles',
      filter: `id=eq.${userId}`,
    }, (payload) => {
      const row = payload?.new || {};
      const out = {
        status: normalizeStatus(row?.moov_status),
        required: row?.moov_account_id ? null : 'account_required',
        bankStatus: row?.bank_verification_status || null,
      };
      try { onUpdate && onUpdate(out); } catch {}
    })
    .subscribe();

  return {
    unsubscribe: () => { try { supabase.removeChannel(channel); } catch {} },
  };
}

export async function fetchOnboardingLink(accessToken) {
  try {
    const API_BASE = Constants.expoConfig?.extra?.waitlistApiBaseUrl || process.env?.EXPO_PUBLIC_WAITLIST_API_BASE_URL || 'https://vybelocal-waitlist.vercel.app';
    if (!accessToken) return { url: null, status: null };
    const resp = await fetch(`${API_BASE}/api/payments/moov/status`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const text = await resp.text();
    let json; try { json = JSON.parse(text); } catch { json = {}; }
    const url = null; // Moov uses Drops, no external onboarding URLs
    const status = normalizeStatus(json?.moov_status);
    return { url, status };
  } catch {
    return { url: null, status: null };
  }
}


