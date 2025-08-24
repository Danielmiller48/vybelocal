/* utils/supabase/avatarCache.js – lightweight in-memory cache for tiny avatar thumbnails (32×32 WebP ~1-2 KB)
   Returns the same signed URL for the given storage path so components don’t regenerate a new token on every render.
*/

import { createSupabaseBrowser } from './client';

const cache = new Map(); // key = path, value = Promise | string

export async function getAvatarUrl(path) {
  if (!path || path === '/avatar-placeholder.png') return '/avatar-placeholder.png';
  if (path.startsWith('http')) return path; // already signed or public

  if (cache.has(path)) {
    const cached = cache.get(path);
    return typeof cached === 'string' ? cached : await cached;
  }

  const supabase = createSupabaseBrowser();

  const promise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from('profile-images')
        .createSignedUrl(path, 60 * 60, {
          transform: {
            width: 64,
            height: 64,
            resize: 'cover',
            quality: 60,
          },
        });
      if (error) throw error;
      const url = data?.signedUrl ?? '/avatar-placeholder.png';
      cache.set(path, url);
      return url;
    } catch (err) {
      console.error('getAvatarUrl()', err?.message || err);
      cache.set(path, '/avatar-placeholder.png');
      return '/avatar-placeholder.png';
    }
  })();

  cache.set(path, promise);
  return await promise;
} 