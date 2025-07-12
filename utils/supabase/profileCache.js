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
    const { data, error } = await supabase
      .from('public_user_cards')
      .select('*')
      .eq('uuid', hostId)
      .single();
    if (error) {
      console.error('getHostProfile', error.message);
      return null;
    }
    cache.set(hostId, data); // replace promise with actual data
    return data;
  })();

  cache.set(hostId, promise);
  return await promise;
} 