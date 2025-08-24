// Batched, cached host stats (strikes last 6mo and completed count)
// Minimizes duplicate reads across cards/modals

import { supabase } from './supabase';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_EVENTS_SCAN = 5000; // safety cap when counting completed via rows
const BATCH_SIZE = 50; // chunk size for IN() queries

const cache = new Map(); // hostId -> { completed:number, cancels:number, exp:number }
const inFlight = new Map(); // hostId -> Promise

let pendingIds = new Set();
let flushTimer = null;

function now() { return Date.now(); }

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flushPending, 0);
}

async function flushPending() {
  const ids = Array.from(pendingIds);
  pendingIds.clear();
  flushTimer = null;
  if (!ids.length) return;

  try {
    const strikesByHost = new Map();
    const completedByHost = new Map();

    // Chunked queries to keep URL and IN() sizes safe
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const slice = ids.slice(i, i + BATCH_SIZE);

      // Strikes per chunk
      const { data: strikeRows } = await supabase
        .from('v_host_strikes_last6mo')
        .select('host_id,strike_count')
        .in('host_id', slice);
      (strikeRows || []).forEach(r => {
        strikesByHost.set(r.host_id, Number(r.strike_count || 0));
      });

      // Completed counts per chunk (rows grouped client-side)
      const { data: completedRows } = await supabase
        .from('v_past_events')
        .select('host_id')
        .in('host_id', slice)
        .lt('starts_at', new Date().toISOString())
        .range(0, MAX_EVENTS_SCAN - 1);
      (completedRows || []).forEach(r => {
        const h = r.host_id;
        completedByHost.set(h, (completedByHost.get(h) || 0) + 1);
      });
    }

    // Resolve all in-flight with assembled stats
    const expiry = now() + CACHE_TTL_MS;
    ids.forEach(hostId => {
      const stats = {
        completed: completedByHost.get(hostId) || 0,
        cancels: strikesByHost.get(hostId) || 0,
      };
      cache.set(hostId, { ...stats, exp: expiry });
      const p = inFlight.get(hostId);
      if (p && p._resolve) p._resolve(stats);
      inFlight.delete(hostId);
    });
  } catch (e) {
    // Fail all in-flight gracefully
    ids.forEach(hostId => {
      const p = inFlight.get(hostId);
      if (p && p._resolve) p._resolve({ completed: 0, cancels: 0 });
      inFlight.delete(hostId);
    });
  }
}

export function getHostStats(hostId) {
  if (!hostId) return Promise.resolve({ completed: 0, cancels: 0 });

  const hit = cache.get(hostId);
  if (hit && hit.exp > now()) {
    return Promise.resolve({ completed: hit.completed, cancels: hit.cancels });
  }

  const existing = inFlight.get(hostId);
  if (existing) return existing;

  // Create a promise we can resolve after batch returns
  let _resolve;
  const promise = new Promise((res) => { _resolve = res; });
  promise._resolve = _resolve;
  inFlight.set(hostId, promise);

  pendingIds.add(hostId);
  scheduleFlush();

  return promise;
}

export function prefetchHostStats(hostIds) {
  const ids = (hostIds || []).filter(Boolean);
  ids.forEach(id => {
    const hit = cache.get(id);
    if (!(hit && hit.exp > now())) pendingIds.add(id);
  });
  if (pendingIds.size) scheduleFlush();
}

export function clearHostStatsCache() {
  cache.clear();
}


