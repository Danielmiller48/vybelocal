// utils/signedUrl.js  – service-role helper (server-only)
import { createClient } from '@supabase/supabase-js';

/* ─── singleton service-role client ─── */
const sbAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

/**
 * Return a signed (optionally transformed) URL for a Storage object.
 *
 * @param {string} bucket     Storage bucket name
 * @param {string} key        Object key, e.g. "abc.jpg"
 * @param {number} ttl        Expiry in seconds (default 3600)
 * @param {object} [transform] { width, height, resize } (optional)
 * @returns {string|null}
 */
export async function signedUrl(bucket, key, ttl = 3600, transform) {
  if (!key) return null;

  const opts = transform ? { transform } : undefined;
  const { data, error } = await sbAdmin
    .storage
    .from(bucket)
    .createSignedUrl(key, ttl, opts);

  if (error) {
    console.error('signedUrl()', error);
    return null;
  }
  return data?.signedUrl ?? null;
}
