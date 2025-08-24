/* utils/supabase/profileCache.js – in-tab cache of host profiles
 * Prevents each EventCard from hitting Supabase for the same host again.
 */
import { createSupabaseBrowser } from './client';

const cache = new Map(); // key = host_id, value = Promise or profile object

export async function getHostProfile(hostId) {
  if (!hostId) return null;
  if (cache.has(hostId)) {
    const cached = cache.get(hostId);
    return typeof cached.then === 'function' ? await cached : cached;
  }

  const supabase = createSupabaseBrowser();
  const promise = (async () => {
    // 1) Primary query: public_user_cards view (contains richer public data)
    const { data, error } = await supabase
      .from('public_user_cards')
      .select('*')
      .eq('uuid', hostId)
      .single();

    let profile = data || null;
    if (error && error.code !== 'PGRST116') {
      // Log unexpected errors (PGRST116 = no rows in result)
      console.error('getHostProfile', error.message);
    }

    // 2) Fallback: if nothing returned OR avatar_url missing, pull minimal row from profiles
    if (!profile || !profile.avatar_url) {
      const { data: basic, error: basicErr } = await supabase
        .from('profiles')
        .select('id as uuid, name, avatar_url, pronouns')
        .eq('id', hostId)
        .maybeSingle();
      if (basicErr && basicErr.code !== 'PGRST116') {
        console.error('getHostProfile fallback', basicErr.message);
      }
      if (basic) {
        profile = {
          ...basic,
          ...(profile || {}), // ensure any extra cols from public_user_cards win if present
        };
      }
    }

    cache.set(hostId, profile); // replace promise with actual data (even if null)
    return profile;
  })();

  cache.set(hostId, promise);
  return await promise;
} 